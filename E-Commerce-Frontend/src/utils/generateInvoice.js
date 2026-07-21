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

// All amounts on this invoice are Nepalese Rupees. en-IN grouping is used
// because Nepal uses the same lakh/crore digit grouping as India.
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

  // ── Payment state ────────────────────────────────────────────────────────
  // Two ways an order carries money: the full ONLINE amount (fonepayPayment)
  // or a non-refundable COD booking advance (fonepayBooking) with the balance
  // collected on delivery. The invoice must state which, and how much is due.
  const isOnline     = order.paymentMethod === "ONLINE";
  const isPaid       = order.paymentStatus === "PAID";
  const advanceAmt   = order.codBookingAmount || 0;
  const advancePaid  = order.codBookingStatus === "PAID" && advanceAmt > 0;
  const grandTotal   = order.totalPrice ?? 0;

  // Amount actually received so far, and what is still outstanding.
  const amountPaid = isPaid ? grandTotal : advancePaid ? advanceAmt : 0;
  const balanceDue = isCancelled || isRefunded ? 0 : Math.max(grandTotal - amountPaid, 0);
  const fullyPaid  = !isRefunded && !isCancelled && balanceDue === 0 && amountPaid > 0;

  const paymentMethodLabel = isOnline
    ? "Online · Fonepay QR"
    : advanceAmt > 0
      ? "COD + Booking Advance"
      : "Cash on Delivery";

  // Single-line status shown in the meta box, colour-coded below.
  let paymentStatusLabel, paymentStatusColor;
  if (isRefunded) {
    paymentStatusLabel = "REFUNDED";
    paymentStatusColor = [21, 128, 61];
  } else if (isCancelled) {
    paymentStatusLabel = "CANCELLED";
    paymentStatusColor = [185, 28, 28];
  } else if (fullyPaid) {
    paymentStatusLabel = "PAID IN FULL";
    paymentStatusColor = [21, 128, 61];
  } else if (advancePaid) {
    paymentStatusLabel = "PARTIALLY PAID";
    paymentStatusColor = [180, 83, 9];
  } else if (order.paymentStatus === "FAILED") {
    paymentStatusLabel = "PAYMENT FAILED";
    paymentStatusColor = [185, 28, 28];
  } else {
    paymentStatusLabel = "UNPAID / PENDING";
    paymentStatusColor = [185, 28, 28];
  }

  // Anything not settled in full is a proforma, not a tax invoice.
  const isProforma = !fullyPaid && !isCancelled && !isRefunded;

  // Header (clean, white background)
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
  const docLabel = isCancelled ? "CREDIT NOTE" : isProforma ? "PROFORMA INVOICE" : "INVOICE";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isProforma && !isCancelled ? 16 : 20);
  doc.setTextColor(20, 20, 20);
  doc.text(docLabel, W - margin, 13, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  if (isCancelled) {
    doc.setTextColor(185, 28, 28);
    doc.text("ORDER CANCELLED", W - margin, 19, { align: "right" });
  } else if (isProforma) {
    doc.setTextColor(...paymentStatusColor);
    doc.text(paymentStatusLabel, W - margin, 19, { align: "right" });
  } else {
    doc.setTextColor(130, 130, 130);
    doc.text("(ORIGINAL FOR RECIPIENT)", W - margin, 19, { align: "right" });
  }
  doc.setTextColor(130, 130, 130);
  doc.text("All amounts in NPR", W - margin, 24, { align: "right" });

  // Divider under the header.
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, W - margin, 28);
  doc.setLineWidth(0.2);
  doc.setTextColor(0, 0, 0);

  y = 37;

  // CANCELLED banner
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

  // REFUNDED banner
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

  // OUTSTANDING PAYMENT banner — shown whenever money is still due, so an
  // unpaid or advance-only order can never be mistaken for a settled one.
  if (isProforma) {
    const partial = advancePaid;
    doc.setFillColor(...(partial ? [255, 251, 235] : [254, 226, 226]));
    doc.setDrawColor(...(partial ? [217, 119, 6] : [220, 38, 38]));
    doc.roundedRect(margin, y - 4, W - margin * 2, partial ? 20 : 14, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...paymentStatusColor);
    doc.text(partial ? "!  PARTIALLY PAID" : "!  PAYMENT PENDING — NOT PAID", margin + 5, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Balance due: ${fmtRs(balanceDue)}`, W - margin - 5, y + 4, { align: "right" });

    if (partial) {
      doc.setFontSize(7.5);
      doc.text(
        `Non-refundable booking advance of ${fmtRs(advanceAmt)} received. Balance payable on delivery.`,
        margin + 5, y + 11
      );
    }

    doc.setTextColor(0, 0, 0);
    y += partial ? 25 : 19;
  }

  // Two-column: Sold By | Invoice Meta
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
  const lx = col2 + 4;   // label x
  const vx = col2 + 38;  // value x  (tight — no overflow)

  const metaRows = [
    ["Invoice No.",   `INV-${shortNum(order.orderNumber)}`, null],
    ["Invoice Date:", fmtDate(order.paidAt || order.createdAt), null],
    ["Order No.:",    shortNum(order.orderNumber), null],
    ["Order Date:",   fmtDate(order.createdAt), null],
    ["Payment Mode:", paymentMethodLabel, null],
    ["Payment Status:", paymentStatusLabel, paymentStatusColor],
  ];
  if (amountPaid > 0) metaRows.push(["Amount Paid:", fmtRs(amountPaid), [21, 128, 61]]);
  if (balanceDue > 0) metaRows.push(["Balance Due:", fmtRs(balanceDue), [185, 28, 28]]);

  const metaH = metaRows.length * 7 + 5;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(col2, y - 4, metaW, metaH, 3, 3, "FD");

  metaRows.forEach(([label, value, color], i) => {
    const ry = y + 2 + i * 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(label, lx, ry);

    doc.setFont("helvetica", color ? "bold" : "normal");
    doc.setFontSize(7.5);
    if (color) doc.setTextColor(...color);
    else       doc.setTextColor(20, 20, 20);
    doc.text(String(value), vx, ry, { maxWidth: metaW - 40 });
  });

  doc.setTextColor(0, 0, 0);
  y += Math.max(metaH + 6, 48);

  // Bill To
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

  // Items table
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

  // Summary (right-aligned box)
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
  const totalLabel = isRefunded ? "NET PAYABLE" : isCancelled ? "CANCELLED" : "ORDER TOTAL";
  doc.text(totalLabel, bx + 4, totalY + 6.5);
  doc.text(isRefunded ? fmtRs(0) : fmtRs(total), W - margin - 2, totalY + 6.5, { align: "right" });
  doc.setTextColor(0, 0, 0);

  let barY = totalY + 10;

  // Settlement lines under the total: what has been received against this
  // order and what is still outstanding.
  if (!isCancelled && !isRefunded && (amountPaid > 0 || balanceDue > 0)) {
    const settleRows = [];
    if (advancePaid) {
      settleRows.push(["Less: Advance Paid", `- ${fmtRs(advanceAmt)}`, [21, 128, 61]]);
    } else if (amountPaid > 0) {
      settleRows.push(["Amount Paid", `- ${fmtRs(amountPaid)}`, [21, 128, 61]]);
    }

    settleRows.forEach(([label, value, color]) => {
      barY += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...color);
      doc.text(label, bx + 4, barY, { maxWidth: bw * 0.6 });
      doc.text(value, W - margin - 2, barY, { align: "right" });
    });
    doc.setTextColor(0, 0, 0);

    // Balance bar — red while money is owed, green once nothing is due.
    barY += 3;
    doc.setFillColor(...(balanceDue > 0 ? [185, 28, 28] : [21, 128, 61]));
    doc.roundedRect(bx, barY, bw, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(
      balanceDue > 0 ? (isOnline ? "BALANCE DUE" : "PAYABLE ON DELIVERY") : "NOTHING DUE",
      bx + 4, barY + 6.5
    );
    doc.text(fmtRs(balanceDue), W - margin - 2, barY + 6.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    barY += 10;
  }

  // Amount in words
  y = Math.max(totalY + 15, barY + 5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    `Amount Chargeable (in words): ${amountToWords(isRefunded ? 0 : total)} Only`,
    margin, y
  );
  if (balanceDue > 0 && !isCancelled && !isRefunded) {
    y += 4.5;
    doc.text(`Balance Payable (in words): ${amountToWords(balanceDue)} Only`, margin, y);
  }

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

  // Payment details block — method, status, and the advance/balance split so
  // the customer can see exactly what has been settled and what has not.
  {
    y += 7;
    const payRows = [
      ["Payment Method", paymentMethodLabel],
      ["Payment Status", paymentStatusLabel],
    ];

    const txn = isOnline ? order.fonepayPayment : order.fonepayBooking;

    if (advanceAmt > 0) {
      payRows.push(["Booking Advance (Non-refundable)", fmtRs(advanceAmt)]);
      payRows.push([
        "Advance Status",
        advancePaid ? `Paid${txn?.paidAt ? ` on ${fmtDateTime(txn.paidAt)}` : ""}` : order.codBookingStatus === "REJECTED" ? "Rejected" : "Pending",
      ]);
    }

    if (isOnline) {
      payRows.push([
        "Amount Received",
        isPaid ? `${fmtRs(grandTotal)}${order.paidAt ? ` on ${fmtDateTime(order.paidAt)}` : ""}` : fmtRs(0),
      ]);
    }

    if (txn?.prn)     payRows.push(["Transaction Ref (PRN)", txn.prn]);
    if (txn?.traceId) payRows.push(["Gateway Trace ID", txn.traceId]);

    if (!isCancelled && !isRefunded) {
      payRows.push([
        balanceDue > 0 ? (isOnline ? "Balance Due" : "Payable on Delivery (Cash)") : "Balance Due",
        fmtRs(balanceDue),
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["Payment Detail", "Value"]],
      body: payRows,
      theme: "grid",
      headStyles: {
        fillColor: balanceDue > 0 && !isCancelled ? [180, 83, 9] : [19, 25, 33],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 62 },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });

    y = doc.lastAutoTable.finalY + 4;

    if (advanceAmt > 0 && !isRefunded) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(180, 83, 9);
      doc.text(
        `Note: The booking advance of ${fmtRs(advanceAmt)} is non-refundable and is not returned if the order is cancelled by the customer.`,
        margin, y, { maxWidth: W - margin * 2 }
      );
      doc.setTextColor(0, 0, 0);
      y += 5;
    }
  }

  // Cancellation / Refund detail block
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

  // Declaration + Signature
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

  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 287, W - margin, 287);
  doc.setFontSize(7);
  doc.text("This is a Computer Generated Invoice", W / 2, 291, { align: "center" });

  // Save
  const suffix = isCancelled ? "Cancelled"
               : isRefunded  ? "Refunded"
               : advancePaid ? "PartiallyPaid"
               : isProforma  ? "Unpaid"
               : "";
  const fname  = `Invoice-${shortNum(order.orderNumber)}${suffix ? "-" + suffix : ""}.pdf`;
  doc.save(fname);
}

// Number → NPR words (up to crores; Nepal uses the lakh/crore scale)
function amountToWords(amount) {
  const n = Math.round(amount);
  if (n === 0) return "NPR Zero";
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
  return `NPR ${convert(n).trim()}`;
}
