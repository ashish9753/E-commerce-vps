import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Share2, ShieldCheck, RefreshCw, Truck, Star, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { couponsApi } from '../api/coupons';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { productsApi } from '../api/products';
import { reviewsApi } from '../api/reviews';
import { deliveryAreasApi } from '../api/deliveryAreas';
import { upayaApi } from '../api/upaya';
import { normalizeProduct, normalizeProducts } from '../utils/normalizers';
import { formatPriceShort, stars } from '../utils/formatters';
import ProductCard from '../components/product/ProductCard';
import FreebieDetailsModal from '../components/FreebieDetailsModal';

/* ── helpers ── */
const Rs = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggle, isWished } = useWishlist();
  const { user } = useAuth();
  const toast = useToast();

  const [product, setProduct]     = useState(null);
  const [related, setRelated]         = useState([]);
  const [otherProducts, setOther]     = useState([]);
  const [reviews, setReviews]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [qty, setQty]             = useState(1);
  // Tab state.
  //  - Desktop (≥769px): one tab is always open. We default to "description"
  //    so users see something below the divider immediately.
  //  - Mobile  (<769px): both panels start collapsed so the page is shorter
  //    on small screens. The user expands the one they care about; clicking
  //    the open tab a second time collapses it again (accordion behavior).
  const isMobileViewport = () =>
    typeof window !== 'undefined' && window.innerWidth < 769;
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [activeTab, setActiveTab] = useState(() =>
    isMobileViewport() ? null : 'description'
  );

  // Keep `isMobile` in sync with viewport changes (rotation, devtools resize).
  // We do NOT auto-open the desktop default when crossing the breakpoint —
  // that would surprise the user mid-interaction. Only initial-load state
  // differs; subsequent toggling stays in the user's hands.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  // Tab click handler: on mobile, clicking the open tab again closes it.
  // On desktop, clicks just switch tabs (one is always open).
  const handleTabClick = (tab) => {
    setActiveTab((current) => {
      if (isMobile && current === tab) return null;   // collapse
      return tab;
    });
  };
  const [activeThumb, setActiveThumb] = useState(0);
  const [selectedColor, setSelectedColor] = useState(''); // chosen color name ('' = none yet)
  const swipeStartX = useRef(null); // tracks touch start X for mobile gallery swipe
  const [location, setLocation]           = useState('');
  const [locationResult, setLocationResult] = useState(null); // { available, city, deliveryCharge } | null
  const [locationChecking, setLocationChecking] = useState(false);
  const [areaSuggestions, setAreaSuggestions]   = useState([]); // active service areas for autocomplete

  const [couponCode, setCouponCode]   = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  // Coupon validated for THIS product (independent of cart). Carried into the
  // Buy Now flow via navigation state.
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, freebie? }
  const [freebieModal, setFreebieModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareCopied, setShareCopied]   = useState(false);

  const [reviewRating, setReviewRating]       = useState(0);
  const [reviewHover, setReviewHover]         = useState(0);
  const [reviewComment, setReviewComment]     = useState('');
  const [reviewImages, setReviewImages]       = useState([]);
  const [reviewLoading, setReviewLoading]     = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  // Delivery check — looks up the typed city in the merged suggestions list
  // (Upaya + custom DeliveryAreas), then falls back to a server-side check
  // for cities the autocomplete didn't pre-load.
  const checkLocation = async (loc) => {
    const q = (loc || location).trim();
    if (!q) return;
    setLocationChecking(true);
    try {
      const ql = q.toLowerCase();
      const matchName = (a) => (a.locationName || a.city || '').toLowerCase();
      // Three-tier match: exact → startsWith → includes
      const match = areaSuggestions.find(a => matchName(a) === ql)
                 || areaSuggestions.find(a => matchName(a).startsWith(ql))
                 || areaSuggestions.find(a => matchName(a).includes(ql));

      // Upaya match → get live rate
      if (match?.source === 'upaya' && match.locationId) {
        try {
          const rateRes = await upayaApi.getRate({
            location_id: match.locationId,
            initial_weight: 1,
            service_type_id: 3,
            order_type: 'delivery_order',
          });
          const rate = rateRes.data?.data?.rate || {};
          const charge = Number(rate.total ?? rate.amount ?? rate.rate ?? rate.deliveryCharge ?? 0);
          setLocationResult({
            available: true,
            city: match.locationName || match.city,
            deliveryCharge: charge,
            source: 'upaya',
          });
          return;
        } catch { /* fall through to legacy check */ }
      }

      // Custom DeliveryArea match → static charge
      if (match?.source === 'custom') {
        setLocationResult({
          available: true,
          city: match.city,
          deliveryCharge: Number(match.deliveryCharge) || 0,
          source: 'custom',
        });
        return;
      }

      // No local match — ask the backend (covers cities not in pre-loaded list)
      const { data } = await deliveryAreasApi.check(q);
      setLocationResult(data.data);
    } catch { setLocationResult({ available: false }); }
    finally { setLocationChecking(false); }
  };

  // Pull the list of serviceable cities so we can power the autocomplete.
  // Load Upaya AND our custom DeliveryArea list and merge — Upaya entries
  // get a locationId (for live rates), custom entries keep their static
  // `deliveryCharge`. De-duplicated by lowercased city name.
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      upayaApi.getLocations(),
      deliveryAreasApi.getAll(),
    ]).then(([upayaRes, areasRes]) => {
      if (!mounted) return;
      const upayaList = upayaRes.status === 'fulfilled'
        ? (upayaRes.value.data?.data?.locations || [])
        : [];
      const customList = areasRes.status === 'fulfilled'
        ? (areasRes.value.data?.data?.areas || [])
        : [];

      const merged = [];
      const seen = new Set();
      // Upaya first — gives us live rates when matched.
      upayaList.forEach(l => {
        const name = (l.locationName || l.city || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({
          id:           `upaya-${l.locationId || name}`,
          locationId:   l.locationId,
          locationName: name,
          city:         name,
          state:        l.address || '',
          areaId:       l.areaId,
          source:       'upaya',
        });
      });
      // Custom areas — only add ones Upaya doesn't already cover.
      customList.forEach(a => {
        const name = (a.city || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({
          id:             `area-${a._id || name}`,
          city:           name,
          state:          a.state || '',
          deliveryCharge: a.deliveryCharge,
          source:         'custom',
        });
      });
      setAreaSuggestions(merged);
    });
    return () => { mounted = false; };
  }, []);

  // Auto-check using saved address city when user is logged in
  useEffect(() => {
    const savedCity = user?.addresses?.[0]?.city;
    if (savedCity && savedCity.trim()) {
      setLocation(savedCity);
      checkLocation(savedCity);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    productsApi.getById(id)
      .then(({ data }) => {
        const p = normalizeProduct(data.data.product);
        setProduct(p);
        const catId = p.categoryObj?._id || p.category;
        if (catId) {
          productsApi.getAll({ category: catId, limit: 9 })
            .then(({ data: rData }) => {
              const prods = normalizeProducts(rData.data?.products || rData.data?.data || [])
                .filter(r => r._id !== p._id).slice(0, 8);
              setRelated(prods);
              // Fetch popular products outside this category
              productsApi.getAll({ sort: 'popular', limit: 16 })
                .then(({ data: oData }) => {
                  const seen = new Set([p._id, ...prods.map(r => r._id)]);
                  const others = normalizeProducts(oData.data?.products || oData.data?.data || [])
                    .filter(r => !seen.has(r._id)).slice(0, 8);
                  setOther(others);
                }).catch(() => {});
            }).catch(() => {});
        } else {
          // No category — just fetch popular products
          productsApi.getAll({ sort: 'popular', limit: 9 })
            .then(({ data: oData }) => {
              const others = normalizeProducts(oData.data?.products || oData.data?.data || [])
                .filter(r => r._id !== p._id).slice(0, 8);
              setOther(others);
            }).catch(() => {});
        }
        reviewsApi.getForProduct(p._id)
          .then(({ data: rData }) => {
            const list = rData.data?.data || rData.data?.reviews || [];
            setReviews(list);
            if (user) {
              setAlreadyReviewed(list.some(r => r.user?._id === user._id || r.user === user._id));
            }
          })
          .catch(() => {});
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Hard cap on quantity — backend allows max 50, UI shouldn't offer more than
  // what's actually in stock either. Computed before early returns so the hooks
  // below run on every render (Rules of Hooks). When a color is selected, the
  // cap follows that color's stock.
  const colorsArr   = product?.colors || [];
  const activeColor = colorsArr.find((c) => c.name === selectedColor) || null;
  const stockNum = activeColor ? (activeColor.stock || 0) : (product?.stock || 0);
  const maxQty = Math.max(1, Math.min(stockNum, 50));

  // If stock dropped (e.g. fresh fetch after someone else bought some), clamp qty.
  useEffect(() => {
    if (qty > maxQty) setQty(maxQty);
    if (qty < 1) setQty(1);
  }, [maxQty]);

  if (loading) return (
    <div className="wrap py-20 text-center">
      <div className="spinner mx-auto" style={{ width:40, height:40 }} />
    </div>
  );
  if (!product) return (
    <div className="wrap py-20 text-center">
      <div style={{ fontSize:80 }}>😕</div>
      <h2 className="text-2xl font-bold mt-4 mb-4">Product not found</h2>
      <button className="btn btn-primary" onClick={() => navigate('/products')}>Browse products</button>
    </div>
  );

  const wished   = isWished(product._id);
  const images   = product.images?.length ? product.images : [];
  const thumbs   = images.slice(0, 6);

  // Touch-swipe for the mobile gallery: swipe left → next photo, swipe right →
  // previous. Wraps around so the strip feels continuous.
  const onGalleryTouchStart = (e) => { swipeStartX.current = e.touches[0].clientX; };
  const onGalleryTouchEnd = (e) => {
    if (swipeStartX.current == null || thumbs.length < 2) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(dx) > 40) {
      setActiveThumb((t) => (dx < 0
        ? (t + 1) % thumbs.length
        : (t - 1 + thumbs.length) % thumbs.length));
    }
    swipeStartX.current = null;
  };

  // ── Share handlers (defined after product is guaranteed non-null) ──────────
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: product.name, url }); return; }
      catch { /* user cancelled */ }
    }
    setShareMenuOpen(v => !v);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setShareCopied(true);
    toast('Link copied!');
    setTimeout(() => setShareCopied(false), 2500);
    setShareMenuOpen(false);
  };

  // ── Lightbox keyboard handler (inside render, after product guaranteed) ────
  const onLightboxKey = (e) => {
    if (e.key === 'Escape')     { setLightboxOpen(false); setLightboxZoom(1); }
    if (e.key === 'ArrowRight') setActiveThumb(t => Math.min(t + 1, thumbs.length - 1));
    if (e.key === 'ArrowLeft')  setActiveThumb(t => Math.max(t - 1, 0));
  };
  // Color variants: when a product has colors, the customer must pick one, and
  // the chosen color drives the price, MRP, stock and main image.
  const hasColors  = colorsArr.length > 0;
  const sale = activeColor
    ? Number(activeColor.discountPrice || activeColor.price || 0)
    : Number(product.price || 0);
  const mrp = activeColor
    ? Number(activeColor.price || activeColor.discountPrice || 0)
    : Number(product.was || product.price || 0);
  const discount = mrp > sale && sale > 0 ? Math.round(((mrp - sale) / mrp) * 100) : 0;
  // Available stock for the current selection (color stock, or product stock).
  const effStock = activeColor ? (activeColor.stock || 0) : product.stock;
  const inStock  = hasColors ? (activeColor ? activeColor.stock > 0 : product.stock > 0) : product.stock > 0;
  // Can order only when in stock AND (color-less OR a color is chosen).
  const canBuy   = inStock && (!hasColors || !!activeColor);
  // Main image swaps to the selected color's image when it has one.
  const mainImage = activeColor?.image || thumbs[activeThumb];

  /* Description lines → bullets */
  const descLines = (product.description || '').split('\n').map(l => l.trim()).filter(Boolean);

  const handleAddToCart = async () => {
    if (!user) { toast('Please sign in to add items to cart', 'error'); navigate('/login'); return; }
    if (hasColors && !activeColor) { toast('Please select a color', 'error'); return; }
    if (qty > effStock) {
      toast(`Only ${effStock} in stock — adjust quantity to continue.`, 'error');
      setQty(maxQty);
      return;
    }
    const result = await addToCart(product._id, qty, selectedColor);
    if (result?.success === false) toast(result.error, 'error');
    else toast(`${product.name}${selectedColor ? ` (${selectedColor})` : ''} added to cart`);
  };
  const handleBuyNow = () => {
    if (!user) { navigate('/login'); return; }
    if (hasColors && !activeColor) { toast('Please select a color', 'error'); return; }
    if (qty > effStock) {
      toast(`Only ${effStock} in stock — adjust quantity to continue.`, 'error');
      setQty(maxQty);
      return;
    }
    navigate('/checkout', {
      state: {
        buyNow: {
          productId:  product._id,
          title:      product.name || product.title,
          price:      sale,
          image:      activeColor?.image || product.images?.[0],
          stock:      effStock,
          quantity:   qty,
          color:      selectedColor,
          couponCode: appliedCoupon?.code || null,
        },
      },
    });
  };
  const handleWish = async () => {
    if (!user) { toast('Please sign in to save items', 'error'); navigate('/login'); return; }
    await toggle(product);
    toast(wished ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const appliedCouponCode = appliedCoupon?.code || null;

  const handleApplyCoupon = async () => {
    if (!user) { toast('Please sign in to apply coupons', 'error'); navigate('/login'); return; }
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const { data } = await couponsApi.validate({
        code,
        directItem: { productId: product._id, quantity: qty },
      });
      const discount     = Number(data?.data?.discount) || 0;
      const freebie      = data?.data?.freebie || null;
      const freeShipping = !!data?.data?.freeShipping;
      setAppliedCoupon({ code, discount, freebie, freeShipping });
      setCouponCode('');
      toast(freebie       ? `Coupon applied! Free gift: ${freebie.title}`
          : freeShipping  ? `Coupon applied! Free shipping unlocked.`
          :                 `Coupon applied! You saved ${formatPriceShort(discount)}`);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not apply coupon';
      toast(msg, 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast('Coupon removed');
  };


  const handleReviewImageChange = (e) => {
    const files = Array.from(e.target.files);
    setReviewImages(prev => {
      const remaining = 2 - prev.length;
      return [...prev, ...files.slice(0, remaining)];
    });
    e.target.value = '';
  };

  const removeReviewImage = (i) => setReviewImages(prev => prev.filter((_, idx) => idx !== i));

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewRating) { toast('Please select a rating', 'error'); return; }
    setReviewLoading(true);
    try {
      const fd = new FormData();
      fd.append('productId', product._id);
      fd.append('rating', reviewRating);
      if (reviewComment.trim()) fd.append('comment', reviewComment.trim());
      reviewImages.forEach(f => fd.append('images', f));
      const { data } = await reviewsApi.create(fd);
      const newReview = data.data?.review;
      if (newReview) setReviews(prev => [newReview, ...prev]);
      setReviewRating(0);
      setReviewHover(0);
      setReviewComment('');
      setReviewImages([]);
      setAlreadyReviewed(true);
      toast('Review submitted successfully!');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to submit review', 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 16px' }}>

        {/* Breadcrumb */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#555', padding:'12px 0' }}>
          <span style={{ cursor:'pointer', color:'#007185' }} onClick={() => navigate('/')}>Home</span>
          <ChevronRight size={12} />
          <span style={{ cursor:'pointer', color:'#007185' }} onClick={() => navigate(`/products?category=${encodeURIComponent(product.category||'')}`)}>
            {product.category || 'Products'}
          </span>
          <ChevronRight size={12} />
          <span style={{ color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>{product.name}</span>
        </div>

        {/* Main 3-col layout */}
        <div className="r-pdp-layout">

          {/* ── Col 1: Image Gallery ── */}
          <div style={{ width:'100%', maxWidth:420 }}>
            {/* Thumbnails + main image side by side */}
            <div style={{ display:'flex', gap:10 }}>
              {/* Thumb strip — desktop only; on phones it moves below the image */}
              {thumbs.length > 1 && !isMobile && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {thumbs.map((img, i) => (
                    <div key={i} onClick={() => setActiveThumb(i)}
                      style={{ width:52, height:52, border:`2px solid ${activeThumb===i ? '#FF5A1F' : '#ddd'}`,
                        borderRadius:4, overflow:'hidden', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        background:'#f7f7f7', flexShrink:0 }}>
                      <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:2 }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div
                onTouchStart={onGalleryTouchStart}
                onTouchEnd={onGalleryTouchEnd}
                style={{ flex:1, aspectRatio:'1', background:'#f7f7f7', borderRadius:6,
                display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative',
                touchAction:'pan-y' }}>
                {mainImage ? (
                  <img src={mainImage} alt={product.name}
                    onClick={() => setLightboxOpen(true)}
                    title="Click to enlarge"
                    draggable={false}
                    style={{ width:'100%', height:'100%', objectFit:'contain', padding:12, cursor:'zoom-in' }} />
                ) : (
                  <span style={{ fontSize:120 }}>🛍️</span>
                )}
                {/* Swipe dots — mobile only */}
                {isMobile && thumbs.length > 1 && (
                  <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex',
                    justifyContent:'center', gap:6, pointerEvents:'none' }}>
                    {thumbs.map((_, i) => (
                      <span key={i} style={{ width:6, height:6, borderRadius:'50%',
                        background: activeThumb === i ? '#FF5A1F' : 'rgba(0,0,0,.22)',
                        transition:'background .2s' }} />
                    ))}
                  </div>
                )}
                {/* Share icon + dropdown */}
                <div style={{ position:'absolute', top:10, right:10 }}>
                  <button onClick={handleShare}
                    style={{ width:34, height:34, borderRadius:'50%', background:'white',
                      border:'1px solid #ddd', cursor:'pointer', display:'flex',
                      alignItems:'center', justifyContent:'center', position:'relative', zIndex:101 }}>
                    <Share2 size={15} color="#555" />
                  </button>

                  {/* Desktop share dropdown */}
                  {shareMenuOpen && (
                    <div style={{ position:'absolute', top:40, right:0, background:'white',
                      border:'1px solid #e0e0e0', borderRadius:12,
                      boxShadow:'0 8px 32px rgba(0,0,0,.18)', zIndex:200, minWidth:210, overflow:'hidden' }}>
                      <div style={{ padding:'12px 16px', fontSize:13, fontWeight:700,
                        color:'#0F1111', borderBottom:'1px solid #f0f0f0' }}>
                        Share this product
                      </div>
                      {[
                        {
                          emoji: shareCopied ? '✅' : '🔗',
                          label: shareCopied ? 'Copied!' : 'Copy Link',
                          action: copyLink,
                        },
                        {
                          emoji: '💬',
                          label: 'WhatsApp',
                          action: () => {
                            window.open(`https://wa.me/?text=${encodeURIComponent(product.name + '\n' + window.location.href)}`, '_blank');
                            setShareMenuOpen(false);
                          },
                        },
                        {
                          emoji: '📘',
                          label: 'Facebook',
                          action: () => {
                            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
                            setShareMenuOpen(false);
                          },
                        },
                        {
                          emoji: '𝕏',
                          label: 'X (Twitter)',
                          action: () => {
                            window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(product.name)}`, '_blank');
                            setShareMenuOpen(false);
                          },
                        },
                      ].map((item, i, arr) => (
                        <button key={i} onClick={item.action}
                          style={{ width:'100%', padding:'12px 16px', textAlign:'left', background:'none',
                            border:'none', borderBottom: i < arr.length - 1 ? '1px solid #f8f8f8' : 'none',
                            cursor:'pointer', fontSize:13, color:'#0F1111',
                            display:'flex', alignItems:'center', gap:10,
                            transition:'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <span style={{ fontSize:16 }}>{item.emoji}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Wishlist + share row */}
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button onClick={handleWish}
                style={{ flex:1, height:38, border:'1px solid #ddd', borderRadius:4, background:'white',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  fontSize:13, fontWeight:600, color:'#333' }}>
                <Heart size={16} fill={wished ? '#FF5A1F' : 'none'} color={wished ? '#FF5A1F' : '#555'} />
                {wished ? 'Wishlisted' : 'Add to Wish List'}
              </button>
            </div>

            {/* Horizontal thumbnail strip — mobile only, below the wishlist button */}
            {isMobile && thumbs.length > 1 && (
              <div style={{ display:'flex', gap:8, marginTop:12, overflowX:'auto',
                paddingBottom:4, scrollbarWidth:'none' }}>
                {thumbs.map((img, i) => (
                  <div key={i} onClick={() => setActiveThumb(i)}
                    style={{ width:56, height:56, flexShrink:0,
                      border:`2px solid ${activeThumb===i ? '#FF5A1F' : '#ddd'}`,
                      borderRadius:6, overflow:'hidden', cursor:'pointer', display:'flex',
                      alignItems:'center', justifyContent:'center', background:'#f7f7f7' }}>
                    <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:2 }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Col 2: Product Info ── */}
          <div style={{ minWidth:0 }}>
            {/* Brand */}
            {product.brand && (
              <div style={{ fontSize:13, color:'#007185', marginBottom:4, cursor:'pointer' }}
                onClick={() => navigate(`/products?brand=${encodeURIComponent(product.brand)}`)}>
                Visit the {product.brand} Store
              </div>
            )}

            {/* Title */}
            <h1 style={{ fontSize:22, fontWeight:400, lineHeight:1.35, color:'#0F1111', margin:'0 0 6px' }}>
              {product.name}
            </h1>

            {/* Model / SKU */}
            {product.sku && (
              <div style={{ fontSize:13, color:'#565959', marginBottom:10 }}>
                Model No.: <span style={{ color:'#0F1111', fontWeight:600 }}>{product.sku}</span>
              </div>
            )}

            {/* Rating row */}
            {(product.rating > 0 || reviews.length > 0) && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, fontSize:13 }}>
                <span style={{ color:'#FF5A1F', fontWeight:700 }}>{Number(product.rating||0).toFixed(1)}</span>
                <span style={{ color:'#FF5A1F', fontSize:15 }}>{stars(product.rating)}</span>
                <span style={{ color:'#007185', cursor:'pointer' }}>({reviews.length} ratings)</span>
              </div>
            )}

            <div style={{ height:1, background:'#e7e7e7', margin:'10px 0' }} />

            {/* Price block */}
            <div style={{ marginBottom:12 }}>
              {discount > 0 && (
                <div style={{ fontSize:14, color:'#CC0C39', fontWeight:600, marginBottom:2 }}>-{discount}% off</div>
              )}
              <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                <span style={{ fontSize:28, fontWeight:400, color:'#0F1111' }}>
                  <span style={{ fontSize:16, verticalAlign:'super', fontWeight:500 }}>Rs.</span>
                  {Math.round(sale).toLocaleString('en-IN')}
                </span>
                {discount > 0 && (
                  <span style={{ fontSize:13, color:'#555' }}>
                    M.R.P: <span style={{ textDecoration:'line-through' }}>{Rs(mrp)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Color selector — required when the product has colors */}
            {hasColors && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#0F1111', marginBottom:8 }}>
                  Color: <span style={{ fontWeight:400, color: selectedColor ? '#0F1111' : '#CC0C39' }}>{selectedColor || 'Select a color'}</span>
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {colorsArr.map((c) => {
                    const isSel = c.name === selectedColor;
                    const out = (c.stock || 0) <= 0;
                    return (
                      <button key={c.name} type="button" disabled={out}
                        onClick={() => { setSelectedColor(c.name); setQty(1); setActiveThumb(0); }}
                        title={out ? `${c.name} — out of stock` : c.name}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:4, borderRadius:8,
                          border:`2px solid ${isSel ? '#FF5A1F' : '#ddd'}`, background:'#fff',
                          cursor: out ? 'not-allowed' : 'pointer', opacity: out ? 0.45 : 1, width:64 }}>
                        <div style={{ width:48, height:48, borderRadius:6, overflow:'hidden', background:'#f7f7f7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {c.image
                            ? <img src={c.image} alt={c.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:9, color:'#999', textAlign:'center' }}>{c.name}</span>}
                        </div>
                        <span style={{ fontSize:11, color: isSel ? '#0F1111' : '#555', fontWeight: isSel ? 700 : 400, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
                {!activeColor && <div style={{ fontSize:12, color:'#CC0C39', marginTop:6 }}>Please select a color to continue.</div>}
              </div>
            )}

            <div style={{ height:1, background:'#e7e7e7', margin:'12px 0' }} />

            {/* Service badges */}
            <div style={{ display:'flex', gap:20, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { icon:<ShieldCheck size={22} color="#555" />, line1:'Warranty', line2:'Brand authorized' },
                { icon:<RefreshCw size={22} color="#555" />, line1: product.returnable===false ? 'Non-returnable' : `${product.returnWindow||7} Day`, line2: product.returnable===false ? '' : 'Easy Return' },
                { icon:<Truck size={22} color="#555" />, line1:'Free Delivery', line2:'Orders above Rs.5,000' },
                { icon:<Star size={22} color="#555" />, line1:'Top Brand', line2:'Authorized seller' },
              ].map((b, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:70, textAlign:'center' }}>
                  {b.icon}
                  <div style={{ fontSize:11, fontWeight:600, color:'#333', lineHeight:1.2 }}>{b.line1}</div>
                  {b.line2 && <div style={{ fontSize:10, color:'#666', lineHeight:1.2 }}>{b.line2}</div>}
                </div>
              ))}
            </div>

            <div style={{ height:1, background:'#e7e7e7', margin:'12px 0' }} />

            {/* Inline spec table */}
            {product.specs?.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16, fontSize:13 }}>
                <tbody>
                  {product.specs.slice(0,6).map((s, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                      <td style={{ padding:'7px 0', width:160, color:'#555', fontWeight:600, verticalAlign:'top' }}>{s.k}</td>
                      <td style={{ padding:'7px 0', color:'#0F1111', verticalAlign:'top' }}>{s.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* About this item */}
            {descLines.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#0F1111', marginBottom:10 }}>About this item</div>
                <ul style={{ margin:0, paddingLeft:20, display:'flex', flexDirection:'column', gap:6 }}>
                  {descLines.map((line, i) => (
                    <li key={i} style={{ fontSize:13, color:'#333', lineHeight:1.6 }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ height:1, background:'#e7e7e7', margin:'16px 0' }} />

            {/* Tabs: specs + description only.
                On mobile both panels are collapsed by default; clicking a tab
                opens it, clicking again collapses (handled by handleTabClick).
                A small chevron is shown on mobile so the affordance is clear. */}
            <div>
              <div style={{ display:'flex', gap:0, borderBottom:'1px solid #e7e7e7', marginBottom: activeTab ? 16 : 0 }}>
                {['description','specs'].map(tab => {
                  const isOpen = activeTab === tab;
                  return (
                    <button key={tab} onClick={() => handleTabClick(tab)}
                      aria-expanded={isMobile ? isOpen : undefined}
                      style={{ padding:'10px 20px', fontSize:13, fontWeight: isOpen ? 700 : 500,
                        color: isOpen ? '#0F1111' : '#666',
                        borderBottom: isOpen ? '3px solid #FF5A1F' : '3px solid transparent',
                        background:'none', border:'none',
                        cursor:'pointer', textTransform:'capitalize',
                        display:'inline-flex', alignItems:'center', gap:6 }}>
                      {tab === 'specs' ? 'Specifications' : 'Product Details'}
                      {isMobile && (
                        <span aria-hidden="true" style={{
                          fontSize: 11, lineHeight: 1, color: isOpen ? '#FF5A1F' : '#9ca3af',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform .2s',
                        }}>▾</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'specs' && (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <tbody>
                    {product.specs.length > 0 ? product.specs.map((s, i) => (
                      <tr key={i} style={{ background: i%2===0 ? '#f7f7f7' : 'white' }}>
                        <td style={{ padding:'9px 12px', width:200, fontWeight:600, color:'#555' }}>{s.k}</td>
                        <td style={{ padding:'9px 12px', color:'#0F1111' }}>{s.v}</td>
                      </tr>
                    )) : <tr><td colSpan={2} style={{ padding:16, color:'#999', textAlign:'center' }}>No specifications available.</td></tr>}
                  </tbody>
                </table>
              )}

              {activeTab === 'description' && (
                <div style={{ fontSize:13, lineHeight:1.8, color:'#333' }}>
                  {product.description || 'No description available.'}
                </div>
              )}
            </div>
          </div>

          {/* ── Col 3: Sticky Buy Box ── */}
          <div style={{ position:'sticky', top:80, alignSelf:'start' }}>
            <div style={{ border:'1px solid #ddd', borderRadius:8, padding:18, background:'white' }}>
              {/* Price */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:24, fontWeight:400, color:'#0F1111' }}>
                  <span style={{ fontSize:14, verticalAlign:'super' }}>Rs.</span>
                  {Math.round(sale).toLocaleString('en-IN')}
                </div>
                {discount > 0 && (
                  <div style={{ fontSize:12, color:'#555', marginTop:2 }}>
                    M.R.P: <span style={{ textDecoration:'line-through' }}>{Rs(mrp)}</span>
                    <span style={{ color:'#CC0C39', marginLeft:6 }}>-{discount}%</span>
                  </div>
                )}
              </div>

              {/* Delivery */}
              <div style={{ fontSize:13, marginBottom:10 }}>
                <span style={{ color:'#555' }}>FREE delivery </span>
                <span style={{ fontWeight:600, color:'#0F1111' }}>on orders above Rs. 5,000</span>
              </div>

              {/* Delivery-by-location checker */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>
                  Check delivery availability
                  {user?.addresses?.[0]?.city && (
                    <span style={{ fontWeight:400, color:'#007185', marginLeft:6 }}>
                      (auto: {user.addresses[0].city})
                    </span>
                  )}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <input
                    list="delivery-areas-options"
                    value={location}
                    onChange={e => { setLocation(e.target.value); setLocationResult(null); }}
                    onKeyDown={e => e.key === 'Enter' && checkLocation('')}
                    placeholder="Enter your city (e.g. Kathmandu, Pokhara)"
                    style={{ flex:1, height:34, border:'1px solid #ddd', borderRadius:4,
                      padding:'0 10px', fontSize:13, outline:'none' }}
                  />
                  <datalist id="delivery-areas-options">
                    {areaSuggestions.map(a => (
                      <option key={a.id || a._id || a.locationId || a.city} value={a.city}>
                        {a.state ? `${a.city}, ${a.state}` : a.city}
                      </option>
                    ))}
                  </datalist>
                  <button onClick={() => checkLocation('')} disabled={!location.trim() || locationChecking}
                    style={{ padding:'0 14px', height:34, borderRadius:4, border:'1px solid #ddd',
                      background:'#f0f2f2', fontSize:12, fontWeight:700, cursor: location.trim() ? 'pointer' : 'not-allowed',
                      color:'#0F1111', whiteSpace:'nowrap' }}>
                    {locationChecking ? '...' : 'Check'}
                  </button>
                </div>
                {locationResult && (
                  locationResult.available ? (
                    <div style={{ marginTop:6, fontSize:12, color:'#007600', fontWeight:600 }}>
                      ✓ Delivery available{locationResult.city ? ` in ${locationResult.city}` : ''}
                      {locationResult.deliveryCharge === 0
                        ? ' — Free delivery'
                        : ` — Delivery charge: Rs. ${locationResult.deliveryCharge}`}
                    </div>
                  ) : (
                    <div style={{ marginTop:6, fontSize:12, color:'#CC0C39', fontWeight:600 }}>
                      ✗ Delivery not available in this area yet
                    </div>
                  )
                )}
              </div>

              {/* Stock */}
              <div style={{ fontSize:18, fontWeight:400, marginBottom:14,
                color: (hasColors && !activeColor) ? '#FF5A1F' : effStock > 5 ? '#007600' : effStock > 0 ? '#FF5A1F' : '#CC0C39' }}>
                {hasColors && !activeColor
                  ? 'Select a color to see availability'
                  : effStock > 5 ? 'In stock' : effStock > 0 ? `Only ${effStock} left` : 'Currently unavailable'}
              </div>

              {/* Quantity — options capped to actual stock so the user can never
                  pick more than is available. */}
              {inStock && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#0F1111', display:'block', marginBottom:4 }}>
                    Quantity: <span style={{ fontWeight:400, color:'#888', fontSize:12 }}>(max {maxQty})</span>
                  </label>
                  <select value={qty} onChange={e => setQty(Number(e.target.value))}
                    style={{ width:'100%', height:36, border:'1px solid #ddd', borderRadius:4, fontSize:13,
                      background:'#f0f2f2', padding:'0 8px', cursor:'pointer' }}>
                    {Array.from({ length: maxQty }, (_, i) => i+1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  {effStock <= 5 && (
                    <div style={{ fontSize:11, color:'#FF5A1F', marginTop:4, fontWeight:600 }}>
                      ⚠ Low stock — only {effStock} available
                    </div>
                  )}
                </div>
              )}

              {/* Add to Cart */}
              <button onClick={handleAddToCart} disabled={!canBuy}
                style={{ width:'100%', height:44, borderRadius:99, border:'none',
                  background: canBuy ? '#FFD814' : '#e5e5e5',
                  color: canBuy ? '#0F1111' : '#999',
                  fontWeight:600, fontSize:14, cursor: canBuy ? 'pointer' : 'not-allowed', marginBottom:8,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <ShoppingCart size={16} /> {hasColors && !activeColor ? 'Select a color' : 'Add to Cart'}
              </button>

              {/* Buy Now */}
              <button onClick={handleBuyNow} disabled={!canBuy}
                style={{ width:'100%', height:44, borderRadius:99, border:'none',
                  background: canBuy ? '#FF5A1F' : '#e5e5e5',
                  color: canBuy ? 'white' : '#999',
                  fontWeight:600, fontSize:14, cursor: canBuy ? 'pointer' : 'not-allowed', marginBottom:14,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                {!inStock ? 'Out of Stock' : (hasColors && !activeColor) ? 'Select a color' : 'Buy Now'}
              </button>

              {/* Coupon */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>Have a coupon?</div>
                {appliedCouponCode ? (
                  <div style={{ background:'#f0fdf4', border:'1px dashed #86efac', borderRadius:6, padding:'8px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:12, color:'#166534', fontWeight:600 }}>
                        {appliedCoupon?.freebie
                          ? <>🎁 <span style={{ fontFamily:'monospace', letterSpacing:'.05em' }}>{appliedCouponCode}</span> applied · free gift unlocked</>
                          : appliedCoupon?.freeShipping
                            ? <>🚚 <span style={{ fontFamily:'monospace', letterSpacing:'.05em' }}>{appliedCouponCode}</span> applied · free shipping</>
                            : <>✓ <span style={{ fontFamily:'monospace', letterSpacing:'.05em' }}>{appliedCouponCode}</span> applied · saved {formatPriceShort(appliedCoupon?.discount || 0)}</>
                        }
                      </span>
                      <button onClick={handleRemoveCoupon}
                        style={{ fontSize:11, color:'#CC0C39', background:'none', border:'none', cursor:'pointer', fontWeight:700, padding:0 }}>
                        Remove
                      </button>
                    </div>
                    {appliedCoupon?.freebie && (
                      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:10, padding:'6px 8px', background:'white', border:'1px solid #bbf7d0', borderRadius:6 }}>
                        <div style={{ width:40, height:40, borderRadius:4, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                          {appliedCoupon.freebie.image
                            ? <img src={appliedCoupon.freebie.image} alt={appliedCoupon.freebie.title} style={{ width:'100%', height:'100%', objectFit:'contain', padding:2 }} />
                            : <span style={{ fontSize:18 }}>🎁</span>}
                        </div>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.1em', color:'#15803d', textTransform:'uppercase' }}>+ FREE</div>
                            {appliedCoupon.freebie.price > 0 && (
                              <div style={{ fontSize:10, color:'#888', textDecoration:'line-through' }}>
                                {Rs((appliedCoupon.freebie.price) * (appliedCoupon.freebie.quantity || 1))}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize:12, fontWeight:700, color:'#0F1111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {appliedCoupon.freebie.title}
                          </div>
                          <div style={{ fontSize:10, color:'#666' }}>
                            Added at checkout · Qty {appliedCoupon.freebie.quantity || 1}
                            {appliedCoupon.freebie.price > 0 && <> · <span style={{ color:'#15803d', fontWeight:700 }}>you save {Rs((appliedCoupon.freebie.price) * (appliedCoupon.freebie.quantity || 1))}</span></>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => appliedCoupon.freebie._id && setFreebieModal(true)}
                          title="View full product details"
                          aria-label="View free gift details"
                          style={{
                            flexShrink:0, width:26, height:26, borderRadius:'50%',
                            border:'1px solid #86efac', background:'#f0fdf4', color:'#15803d',
                            fontWeight:800, fontSize:13, fontFamily:'Georgia, serif',
                            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                            lineHeight:1, padding:0,
                          }}
                        >
                          i
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:6 }}>
                    <input
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      placeholder="Enter coupon code"
                      style={{ flex:1, height:34, border:'1px solid #ddd', borderRadius:4,
                        padding:'0 10px', fontSize:12, outline:'none', fontFamily:'monospace',
                        textTransform:'uppercase', letterSpacing:'.05em' }}
                    />
                    <button onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}
                      style={{ padding:'0 12px', height:34, borderRadius:4, border:'1px solid #ddd',
                        background:'#f0f2f2', fontSize:12, fontWeight:700,
                        cursor: couponCode.trim() ? 'pointer' : 'not-allowed', color:'#0F1111', whiteSpace:'nowrap' }}>
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              {/* Seller info */}
              <div style={{ fontSize:12, color:'#555', display:'flex', flexDirection:'column', gap:5 }}>
                <div><span style={{ display:'inline-block', width:80 }}>Delivery</span><span style={{ color:'#0F1111', fontWeight:500 }}>Upaya</span></div>
                <div><span style={{ display:'inline-block', width:80 }}>Sold by</span><span style={{ color:'#007185', fontWeight:500, cursor:'pointer' }}>TradeEngine</span></div>
                <div><span style={{ display:'inline-block', width:80 }}>Payment</span><span style={{ color:'#0F1111', fontWeight:500 }}>Fonepay</span></div>
              </div>

              {/* Return policy */}
              <div style={{ marginTop:14, padding:'10px 12px', background:'#f7f7f7', borderRadius:6, fontSize:12 }}>
                {product.returnable === false ? (
                  <div style={{ color:'#CC0C39', fontWeight:600 }}>🚫 Non-returnable item</div>
                ) : (
                  <div style={{ color:'#007600' }}>✓ {product.returnWindow||7}-day easy return policy</div>
                )}
                <div style={{ color:'#007600', marginTop:4 }}>✓ Brand authorized warranty</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Related Products ── */}
        {related.length > 0 && (
          <section style={{ paddingBottom:32 }}>
            <div style={{ height:1, background:'#e7e7e7', marginBottom:24 }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#0F1111' }}>Related Products</div>
              <span style={{ fontSize:13, color:'#007185' }}>{related.length} items</span>
            </div>
            <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-3 max-md:grid-cols-2">
              {related.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          </section>
        )}

        {/* ── You May Also Like ── */}
        {otherProducts.length > 0 && (
          <section style={{ paddingBottom:32 }}>
            <div style={{ height:1, background:'#e7e7e7', marginBottom:24 }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#0F1111' }}>You May Also Like</div>
              <span style={{ fontSize:13, color:'#007185' }}>{otherProducts.length} items</span>
            </div>
            <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-3 max-md:grid-cols-2">
              {otherProducts.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          </section>
        )}

        {/* ── Customer Reviews ── */}
        <div style={{ borderTop:'1px solid #e7e7e7', paddingTop:32, marginBottom:40 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#0F1111', marginBottom:20 }}>
            Customer Reviews
            {reviews.length > 0 && <span style={{ fontSize:14, fontWeight:400, color:'#666', marginLeft:10 }}>({reviews.length} ratings)</span>}
          </div>

          {/* Write a Review */}
          {user ? (
            alreadyReviewed ? (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
                padding:'12px 16px', marginBottom:24, fontSize:13, color:'#166534' }}>
                ✓ You have already submitted a review for this product.
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit}
                style={{ background:'#fafafa', border:'1px solid #e7e7e7', borderRadius:8, padding:20, marginBottom:32 }}>
                <div style={{ fontSize:16, fontWeight:700, color:'#0F1111', marginBottom:16 }}>Write a Review</div>

                {/* Star picker */}
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#333', display:'block', marginBottom:8 }}>
                    Overall Rating <span style={{ color:'#CC0C39' }}>*</span>
                  </label>
                  <div style={{ display:'flex', gap:4 }}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n}
                        onClick={() => setReviewRating(n)}
                        onMouseEnter={() => setReviewHover(n)}
                        onMouseLeave={() => setReviewHover(0)}
                        style={{ fontSize:36, cursor:'pointer', lineHeight:1, userSelect:'none',
                          color:(reviewHover||reviewRating) >= n ? '#FF5A1F' : '#d1d5db' }}>
                        ★
                      </span>
                    ))}
                  </div>
                  {reviewRating > 0 && (
                    <div style={{ fontSize:12, color:'#666', marginTop:4 }}>
                      {['','Poor','Fair','Good','Very Good','Excellent'][reviewRating]}
                    </div>
                  )}
                </div>

                {/* Comment */}
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#333', display:'block', marginBottom:6 }}>
                    Your Review
                  </label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    rows={4}
                    style={{ width:'100%', border:'1px solid #ddd', borderRadius:6, padding:'10px 12px',
                      fontSize:13, resize:'vertical', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>

                {/* Image upload (max 2) */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#333', display:'block', marginBottom:6 }}>
                    Add Photos <span style={{ fontWeight:400, color:'#888' }}>(optional, max 2)</span>
                  </label>
                  {reviewImages.length > 0 && (
                    <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                      {reviewImages.map((f, i) => (
                        <div key={i} style={{ position:'relative', width:72, height:72 }}>
                          <img src={URL.createObjectURL(f)} alt=""
                            style={{ width:72, height:72, objectFit:'cover', borderRadius:6, border:'1px solid #ddd' }} />
                          <button type="button" onClick={() => removeReviewImage(i)}
                            style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%',
                              background:'#CC0C39', color:'white', border:'none', cursor:'pointer',
                              fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {reviewImages.length < 2 && (
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px',
                      border:'1px dashed #aaa', borderRadius:6, cursor:'pointer', fontSize:13, color:'#555' }}>
                      <span>+ Add Photo</span>
                      <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleReviewImageChange} style={{ display:'none' }} multiple />
                    </label>
                  )}
                </div>

                <button type="submit" disabled={reviewLoading || !reviewRating}
                  style={{ padding:'10px 28px', borderRadius:6, border:'none',
                    background: reviewRating ? '#FF5A1F' : '#e5e5e5',
                    color: reviewRating ? 'white' : '#999',
                    fontWeight:700, fontSize:14, cursor: reviewRating ? 'pointer' : 'not-allowed' }}>
                  {reviewLoading ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )
          ) : (
            <div style={{ background:'#fff8f1', border:'1px solid #fed7aa', borderRadius:8,
              padding:'12px 16px', marginBottom:24, fontSize:13, color:'#9a3412' }}>
              <span style={{ cursor:'pointer', fontWeight:700, color:'#FF5A1F' }} onClick={() => navigate('/login')}>
                Sign in
              </span>{' '}to write a review
            </div>
          )}

          {/* Ratings summary + list */}
          {reviews.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#999' }}>
              <div style={{ fontSize:56 }}>★</div>
              <p style={{ fontSize:14, marginTop:8 }}>No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:40 }}>
              {/* Rating summary sidebar */}
              <div>
                <div style={{ fontSize:48, fontWeight:900, lineHeight:1, color:'#0F1111' }}>{Number(product.rating||0).toFixed(1)}</div>
                <div style={{ color:'#FF5A1F', fontSize:20, margin:'6px 0' }}>{stars(product.rating)}</div>
                <div style={{ fontSize:13, color:'#666', marginBottom:16 }}>{reviews.length} global ratings</div>
                {[5,4,3,2,1].map(n => {
                  const count = reviews.filter(r => r.rating === n).length;
                  const pct = reviews.length ? Math.round((count/reviews.length)*100) : 0;
                  return (
                    <div key={n} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:13, color:'#007185', width:40, flexShrink:0 }}>{n} star</span>
                      <div style={{ flex:1, height:10, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:'#FF5A1F', borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:12, color:'#888', width:30, textAlign:'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Review list */}
              <div>
                {reviews.map((r, i) => (
                  <div key={i} style={{ borderBottom:'1px solid #f0f0f0', paddingBottom:20, marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#FF5A1F', color:'white',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15, flexShrink:0 }}>
                        {(r.user?.name||'C')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight:700, fontSize:14, color:'#0F1111' }}>{r.user?.name||'Customer'}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ color:'#FF5A1F', fontSize:16 }}>{stars(r.rating)}</span>
                      {r.isVerifiedPurchase && (
                        <span style={{ fontSize:11, fontWeight:700, color:'#007600', background:'#e6f4ea', padding:'2px 8px', borderRadius:99 }}>
                          ✓ Verified Purchase
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>
                      Reviewed on {new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
                    </div>
                    {r.comment && <p style={{ margin:0, fontSize:14, color:'#333', lineHeight:1.7 }}>{r.comment}</p>}
                    {r.images?.length > 0 && (
                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                        {r.images.map((img, j) => (
                          <img key={j} src={img} alt=""
                            style={{ width:70, height:70, objectFit:'cover', borderRadius:6, border:'1px solid #eee', cursor:'pointer' }}
                            onClick={() => window.open(img, '_blank')} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {freebieModal && appliedCoupon?.freebie?._id && (
        <FreebieDetailsModal
          productId={appliedCoupon.freebie._id}
          quantity={appliedCoupon.freebie.quantity || 1}
          onClose={() => setFreebieModal(false)}
        />
      )}

      {/* ── Share menu backdrop (close on outside click) ── */}
      {shareMenuOpen && (
        <div onClick={() => setShareMenuOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:100 }} />
      )}

      {/* ── Image Lightbox ── */}
      {lightboxOpen && (
        <div
          onClick={() => { setLightboxOpen(false); setLightboxZoom(1); }}
          onKeyDown={onLightboxKey}
          tabIndex={-1}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.93)',
            zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
            outline:'none' }}>

          {/* Close × */}
          <button
            onClick={() => { setLightboxOpen(false); setLightboxZoom(1); }}
            style={{ position:'absolute', top:16, right:16, width:42, height:42, borderRadius:'50%',
              background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.3)',
              color:'white', fontSize:24, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
            ×
          </button>

          {/* Image counter */}
          {thumbs.length > 1 && (
            <div style={{ position:'absolute', top:20, left:'50%', transform:'translateX(-50%)',
              color:'rgba(255,255,255,.7)', fontSize:13, zIndex:1 }}>
              {activeThumb + 1} / {thumbs.length}
            </div>
          )}

          {/* ← Prev */}
          {thumbs.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setActiveThumb(t => Math.max(0, t - 1)); setLightboxZoom(1); }}
              disabled={activeThumb === 0}
              style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)',
                width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,.15)',
                border:'1px solid rgba(255,255,255,.3)', color:'white', fontSize:28,
                cursor: activeThumb > 0 ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: activeThumb === 0 ? .25 : 1, zIndex:1 }}>
              ‹
            </button>
          )}

          {/* → Next */}
          {thumbs.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setActiveThumb(t => Math.min(thumbs.length - 1, t + 1)); setLightboxZoom(1); }}
              disabled={activeThumb === thumbs.length - 1}
              style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)',
                width:48, height:48, borderRadius:'50%', background:'rgba(255,255,255,.15)',
                border:'1px solid rgba(255,255,255,.3)', color:'white', fontSize:28,
                cursor: activeThumb < thumbs.length - 1 ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: activeThumb === thumbs.length - 1 ? .25 : 1, zIndex:1 }}>
              ›
            </button>
          )}

          {/* Main zoomable image */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ display:'flex', alignItems:'center', justifyContent:'center',
              maxWidth:'88vw', maxHeight:'80vh', overflow: lightboxZoom > 1 ? 'auto' : 'visible' }}>
            <img
              src={thumbs[activeThumb]}
              alt={product.name}
              onClick={() => setLightboxZoom(z => z >= 2 ? 1 : z + 0.75)}
              style={{
                maxWidth:  lightboxZoom === 1 ? '88vw'  : 'none',
                maxHeight: lightboxZoom === 1 ? '78vh'  : 'none',
                width:     lightboxZoom > 1   ? `${lightboxZoom * 65}vw` : 'auto',
                objectFit: 'contain',
                cursor:    lightboxZoom >= 2  ? 'zoom-out' : 'zoom-in',
                transition:'transform .25s, width .25s',
                userSelect:'none',
                borderRadius: 6,
              }}
            />
          </div>

          {/* Zoom controls */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ position:'absolute', bottom: thumbs.length > 1 ? 90 : 24,
              left:'50%', transform:'translateX(-50%)',
              display:'flex', gap:6, zIndex:1, alignItems:'center' }}>
            <button
              onClick={() => setLightboxZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))}
              style={{ width:36, height:36, borderRadius:6, background:'rgba(255,255,255,.15)',
                border:'1px solid rgba(255,255,255,.3)', color:'white', fontSize:20,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              −
            </button>
            <span style={{ color:'white', fontSize:13, minWidth:46, textAlign:'center',
              background:'rgba(255,255,255,.1)', padding:'4px 8px', borderRadius:6 }}>
              {Math.round(lightboxZoom * 100)}%
            </span>
            <button
              onClick={() => setLightboxZoom(z => Math.min(4, +(z + 0.5).toFixed(1)))}
              style={{ width:36, height:36, borderRadius:6, background:'rgba(255,255,255,.15)',
                border:'1px solid rgba(255,255,255,.3)', color:'white', fontSize:20,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              +
            </button>
            <button
              onClick={() => setLightboxZoom(1)}
              style={{ padding:'4px 12px', height:36, borderRadius:6, background:'rgba(255,255,255,.1)',
                border:'1px solid rgba(255,255,255,.25)', color:'rgba(255,255,255,.75)',
                fontSize:12, cursor:'pointer' }}>
              Reset
            </button>
          </div>

          {/* Thumbnail strip */}
          {thumbs.length > 1 && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
                display:'flex', gap:6, zIndex:1 }}>
              {thumbs.map((img, i) => (
                <div key={i}
                  onClick={() => { setActiveThumb(i); setLightboxZoom(1); }}
                  style={{ width:46, height:46, borderRadius:5, overflow:'hidden', cursor:'pointer',
                    border:`2px solid ${activeThumb === i ? '#FF5A1F' : 'rgba(255,255,255,.35)'}`,
                    opacity: activeThumb === i ? 1 : .55, transition:'opacity .2s, border-color .2s' }}>
                  <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
