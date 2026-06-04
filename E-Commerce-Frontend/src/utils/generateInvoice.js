import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY } from "../config/company";

// Pull invoice header values from the central company config so updating
// office/email/phone there propagates to the generated PDF too.
const STORE = {
  name:      COMPANY.name,
  legalName: COMPANY.legalName || COMPANY.name,
  regNo:     COMPANY.regNo || "",
  tagline:   COMPANY.tagline,
  address:   COMPANY.office,
  email:     COMPANY.email,
  phone:     `Sales ${COMPANY.salesPhone} · Support ${COMPANY.supportPhone}`,
  salesPhone: COMPANY.salesPhone,
  website:   COMPANY.website,
};

function fmtRs(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Short order number — last 8 chars of the full order number
function shortNum(orderNumber) {
  if (!orderNumber) return "—";
  // If it's the long format ORD-TIMESTAMP-XXXX, show just the suffix
  const parts = orderNumber.split("-");
  if (parts.length >= 3) return parts[parts.length - 1].toUpperCase();
  return orderNumber.toUpperCase();
}

export async function generateInvoice(order, user) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W      = 210;
  const margin = 14;
  let y = 0;

  const isCancelled = order.orderStatus === "CANCELLED";
  const isRefunded  = order.paymentStatus === "REFUNDED" || order.refundStatus === "COMPLETED";

  // ── Header (clean, white background) ─────────────────────────────────────
  // Company legal name — bold black, left aligned.
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(STORE.legalName, margin, 13);

  // Contact line: phone · email · location — muted grey.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  const contactLine = [STORE.salesPhone, STORE.email, STORE.address]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(contactLine, margin, 19);
  if (STORE.regNo) {
    doc.text(`Reg No:  ${STORE.regNo}`, margin, 24);
  }

  // INVOICE / CREDIT NOTE label — dark, right aligned.
  const docLabel = isCancelled ? "CREDIT NOTE" : "INVOICE";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(docLabel, W - margin, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  if (isCancelled) {
    doc.setTextColor(185, 28, 28);
    doc.text("ORDER CANCELLED", W - margin, 19, { align: "right" });
  } else {
    doc.setTextColor(130, 130, 130);
    doc.text("(ORIGINAL FOR RECIPIENT)", W - margin, 19, { align: "right" });
  }

  // Divider under the header.
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, W - margin, 28);
  doc.setLineWidth(0.2);
  doc.setTextColor(0, 0, 0);

  y = 37;

  // ── CANCELLED banner ──────────────────────────────────────────────────
  if (isCancelled) {
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.roundedRect(margin, y - 4, W - margin * 2, 20, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠  ORDER CANCELLED", margin + 5, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(153, 27, 27);

    const reason  = order.cancellationReason || "Cancelled by user";
    const cancelAt = order.statusHistory?.find(h => h.status === "CANCELLED")?.timestamp
                  || order.updatedAt;
    doc.text(`Reason: ${reason}`, margin + 5, y + 10);
    doc.text(`Cancelled on: ${fmtDateTime(cancelAt)}`, W - margin - 2, y + 10, { align: "right" });

    doc.setTextColor(0, 0, 0);
    y += 25;
  }

  // ── REFUNDED banner ───────────────────────────────────────────────────
  if (isRefunded && !isCancelled) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(22, 163, 74);
    doc.roundedRect(margin, y - 4, W - margin * 2, 14, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(21, 128, 61);
    doc.text("✓  REFUND PROCESSED", margin + 5, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const refAmt = order.refundAmount ? `  Amount: ${fmtRs(order.refundAmount)}` : "";
    doc.text(refAmt, margin + 70, y + 4);

    doc.setTextColor(0, 0, 0);
    y += 19;
  }

  // ── Two-column: Sold By | Invoice Meta ───────────────────────────────
  const col2 = 108;
  const metaW = W - col2 - margin;

  // Sold By
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Sold By:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(STORE.name,    margin, y + 5);
  doc.text(STORE.address, margin, y + 10, { maxWidth: 88 });
  doc.text(`Email: ${STORE.email}`, margin, y + 20);
  doc.text(`Phone: ${STORE.phone}`, margin, y + 25);

  // Invoice meta box — two tight columns inside
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(col2, y - 4, metaW, 42, 3, 3, "FD");

  const lx = col2 + 4;   // label x
  const vx = col2 + 38;  // value x  (tight — no overflow)

  const metaRows = [
    ["Invoice No.",   `INV-${shortNum(order.orderNumber)}`],
    ["Invoice Date:", fmtDate(order.paidAt || order.createdAt)],
    ["Order No.:",    shortNum(order.orderNumber)],
    ["Order Date:",   fmtDate(order.createdAt)],
    ["Payment:",      order.paymentMethod === "ONLINE" ? "Online / UPI" : "Cash on Delivery"],
  ];

  metaRows.forEach(([label, value], i) => {
    const ry = y + 2 + i * 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(label, lx, ry);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    doc.text(String(value), vx, ry, { maxWidth: metaW - 40 });
  });

  doc.setTextColor(0, 0, 0);
  y += 48;

  // ── Bill To ───────────────────────────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Bill To / Ship To:", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const addr       = order.shippingAddress || {};
  const buyerName  = addr.fullName  || user?.name  || "—";
  const buyerPhone = addr.phone     || user?.phone || "—";
  const buyerEmail = user?.email    || "—";
  const addrLine   = [addr.houseNo, addr.area, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");

  doc.text(buyerName, margin + 4, y + 12);
  doc.text(`Phone: ${buyerPhone}   |   Email: ${buyerEmail}`, margin + 4, y + 18);
  if (addrLine) doc.text(addrLine, margin + 4, y + 24, { maxWidth: W - margin * 2 - 8 });

  y += 33;

  // ── Items table ───────────────────────────────────────────────────────
  const items = order.orderItems || [];

  const tableBody = items.map((item, i) => {
    const lineTotal = item.price * item.quantity;

    // Strikethrough style for cancelled items
    const cellStyle = isCancelled ? { textColor: [150, 150, 150] } : {};

    // Freebie line: show its retail worth so the customer sees what they got
    // free, while the Amount column reads FREE (it doesn't add to the total).
    if (item.isFreebie) {
      const worth = item.freebieValue || 0;
      const desc  = item.color ? `${item.title}\nColor: ${item.color}` : item.title;
      const giftStyle = isCancelled ? cellStyle : { textColor: [21, 128, 61] };
      return [
        { content: String(i + 1), styles: giftStyle },
        { content: `${desc}\n(Free Gift)`, styles: giftStyle },
        { content: String(item.quantity), styles: { ...giftStyle, halign: "center" } },
        { content: worth > 0 ? fmtRs(worth) : "—", styles: { ...giftStyle, halign: "right" } },
        { content: "FREE", styles: { ...giftStyle, halign: "right", fontStyle: "bold" } },
      ];
    }

    return [
      { content: String(i + 1), styles: cellStyle },
      { content: item.color ? `${item.title}\nColor: ${item.color}` : item.title, styles: cellStyle },
      { content: String(item.quantity), styles: { ...cellStyle, halign: "center" } },
      { content: fmtRs(item.price),     styles: { ...cellStyle, halign: "right" } },
      { content: fmtRs(lineTotal),      styles: { ...cellStyle, halign: "right" } },
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Product Description", "Qty", "Unit Price", "Amount"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: isCancelled ? [120, 53, 53] : [19, 25, 33],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 104 },
      2: { halign: "center", cellWidth: 10 },
      3: { halign: "right",  cellWidth: 25 },
      4: { halign: "right",  cellWidth: 28 },
    },
    bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Summary (right-aligned box) ───────────────────────────────────────
  const bx = 118;
  const bw = W - bx - margin;

  const itemsPrice  = order.itemsPrice ?? items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shipping    = order.shippingPrice  ?? 0;
  const discount    = order.discountAmount ?? 0;
  const total       = order.totalPrice ?? (itemsPrice + shipping - discount);

  const summaryRows = [
    ["Subtotal", fmtRs(itemsPrice)],
    ["Shipping", shipping === 0 ? "FREE" : fmtRs(shipping)],
  ];
  if (discount > 0) summaryRows.push(["Discount / Coupon", `- ${fmtRs(discount)}`]);
  if (isRefunded)   summaryRows.push(["Amount Refunded",  `- ${fmtRs(order.refundAmount || total)}`]);

  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: "plain",
    showHead: false,
    margin: { left: bx, right: margin },
    tableWidth: bw,
    bodyStyles: { fontSize: 7.5, textColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: bw * 0.56, fontStyle: "bold" },
      1: { cellWidth: bw * 0.44, halign: "right"  },
    },
  });

  const totalY = doc.lastAutoTable.finalY + 2;

  // Grand total bar
  const totalBg = isCancelled ? [185, 28, 28] : isRefunded ? [21, 128, 61] : [19, 25, 33];
  doc.setFillColor(...totalBg);
  doc.roundedRect(bx, totalY, bw, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const totalLabel = isRefunded ? "NET PAYABLE" : isCancelled ? "CANCELLED" : "TOTAL";
  doc.text(totalLabel, bx + 4, totalY + 6.5);
  doc.text(isRefunded ? fmtRs(0) : fmtRs(total), W - margin - 2, totalY + 6.5, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Amount in words
  y = totalY + 15;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    `Amount Chargeable (in words): ${amountToWords(isRefunded ? 0 : total)} Only`,
    margin, y
  );

  // Free-gift savings note — sums the retail worth of every freebie line so the
  // customer sees how much value the order included at no cost.
  const freebieWorth = items.reduce(
    (s, it) => s + (it.isFreebie ? (it.freebieValue || 0) * (it.quantity || 1) : 0),
    0
  );
  if (freebieWorth > 0 && !isCancelled) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text(`You received free gift(s) worth ${fmtRs(freebieWorth)} with this order.`, margin, y);
    doc.setTextColor(0, 0, 0);
  }

  // ── Cancellation / Refund detail block ────────────────────────────────
  if (isCancelled || isRefunded) {
    y += 7;
    const rows = [];

    if (isCancelled) {
      const cancelAt = order.statusHistory?.find(h => h.status === "CANCELLED")?.timestamp || order.updatedAt;
      rows.push(["Cancellation Reason", order.cancellationReason || "Cancelled by user"]);
      rows.push(["Cancelled On",        fmtDateTime(cancelAt)]);
    }

    if (isRefunded) {
      rows.push(["Refund Amount",  fmtRs(order.refundAmount || total)]);
      rows.push(["Refund Status",  "Processed"]);
      if (order.refundStatus === "COMPLETED" || order.paymentStatus === "REFUNDED") {
        rows.push(["Refund Mode",  order.paymentMethod === "ONLINE" ? "Original Payment Method" : "Bank / UPI Transfer"]);
      }
    }

    autoTable(doc, {
      startY: y,
      head: [["Detail", "Value"]],
      body: rows,
      theme: "grid",
      headStyles: {
        fillColor: isCancelled ? [185, 28, 28] : [21, 128, 61],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55 },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });

    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Declaration + Signature ───────────────────────────────────────────
  y += (isCancelled || isRefunded) ? 2 : 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  [
    "We declare that this invoice shows the actual price of the goods / services described",
    "and that all particulars are true and correct.",
  ].forEach((line, i) => doc.text(line, margin, y + i * 4.5));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`for ${STORE.name}`, W - margin - 2, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Authorised Signatory", W - margin - 2, y + 14, { align: "right" });

  // ── Footer ────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 287, W - margin, 287);
  doc.setFontSize(7);
  doc.text("This is a Computer Generated Invoice", W / 2, 291, { align: "center" });

  // ── Save ──────────────────────────────────────────────────────────────
  const suffix = isCancelled ? "Cancelled" : isRefunded ? "Refunded" : "";
  const fname  = `Invoice-${shortNum(order.orderNumber)}${suffix ? "-" + suffix : ""}.pdf`;
  doc.save(fname);
}

// Number → INR words (up to crores)
function amountToWords(amount) {
  const n = Math.round(amount);
  if (n === 0) return "INR Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
                 "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
                 "Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function convert(num) {
    if (num === 0)       return "";
    if (num < 20)        return ones[num] + " ";
    if (num < 100)       return tens[Math.floor(num / 10)] + " " + ones[num % 10] + " ";
    if (num < 1000)      return ones[Math.floor(num / 100)] + " Hundred " + convert(num % 100);
    if (num < 100000)    return convert(Math.floor(num / 1000)) + "Thousand " + convert(num % 1000);
    if (num < 10000000)  return convert(Math.floor(num / 100000)) + "Lakh " + convert(num % 100000);
    return convert(Math.floor(num / 10000000)) + "Crore " + convert(num % 10000000);
  }
  return `INR ${convert(n).trim()}`;
}
