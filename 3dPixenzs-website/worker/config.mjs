export function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings must be an object.');
  const text = (input, max=2000) => {
    if (typeof input !== 'string' || input.length > max) throw new Error('A text field is missing or too long.');
    return input;
  };
  const number = (input,max=1000000) => {
    if (!Number.isSafeInteger(input) || input < 0 || input > max) throw new Error('Enter a valid nonnegative whole number.');
    return input;
  };
  const boolean = input => { if (typeof input !== 'boolean') throw new Error('Invalid toggle.'); return input; };
  const choice = (input,values) => { if (!values.includes(input)) throw new Error('Invalid layout choice.'); return input; };
  const image = input => {
    text(input,500);
    if (!/^(?:[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)|\/media\/[a-zA-Z0-9._-]+)$/.test(input)) throw new Error('Use a store image or upload a PNG, JPEG or WebP.');
    return input;
  };
  const result = {schemaVersion:3};
  result.shippingEnabled=boolean(value.shippingEnabled ?? false);
  result.orderEmail=text(value.orderEmail ?? 'Anvith.mantravadI@gmail.com',254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.orderEmail)) throw new Error('Enter a valid order email.');
  result.paymentMethod='cash_on_delivery';
  result.adultOnly=true;
  result.productAge='13+';
  result.deliveryArea=text(value.deliveryArea ?? 'New Jersey local handoff by confirmation',300);
  result.supportEmail=text(value.supportEmail ?? "anvith206@gmail.com",254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.supportEmail)) throw new Error("Enter a valid support email.");
  result.returnDays=number(value.returnDays ?? 30,365);
  result.zelleQrImage=value.zelleQrImage ? image(value.zelleQrImage) : "";
  result.mixBundles=boolean(value.mixBundles ?? true);
  for (const key of ['brand','tagline','legalName','mailingAddress','recipientName','heroTitle','heroText','heroEyebrow','promoText','bannerText','bannerDetail','collectionTitle','footerText']) result[key]=text(value[key]);
  if (!result.brand.trim()) throw new Error('Enter a company name.');
  result.phone=text(value.phone,15);
  if (!/^\d{10}$/.test(result.phone)) throw new Error('Enter a 10-digit U.S. phone number.');
  result.heroImage=image(value.heroImage);
  result.colors={};
  for (const key of ['background','text','accent','banner']) {
    if (!/^#[a-fA-F0-9]{6}$/.test(value.colors?.[key])) throw new Error('Use six-digit hex colors.');
    result.colors[key]=value.colors[key];
  }
  result.font=choice(value.font,['sans','condensed','serif']);
  result.columns=choice(value.columns,[2,3,4]);
  result.heroLayout=choice(value.heroLayout,['image-right','image-left','centered']);
  result.cardStyle=choice(value.cardStyle,['square','rounded']);
  if (!Array.isArray(value.sections) || value.sections.length!==8 || new Set(value.sections.map(s=>s.id)).size!==8) throw new Error('Keep all eight section controls.');
  const sectionIds=['promo','hero','benefits','banner','shop','offer','how','faq'];
  result.sections=value.sections.map(s=>({id:choice(s.id,sectionIds),enabled:boolean(s.enabled)}));
  for (const key of ['emailOffer','couponEnabled']) result[key]=boolean(value[key]);
  result.couponCode=text(value.couponCode,30).trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,30}$/.test(result.couponCode)) throw new Error('Use letters and numbers for the coupon.');
  result.couponPercent=number(value.couponPercent,100);
  result.shippingCents=number(value.shippingCents);
  result.freeShippingOverCents=number(value.freeShippingOverCents);
  result.shippingDays=number(value.shippingDays,365);
  if (!result.shippingDays) throw new Error('Shipping days must be at least one.');
  if (!Array.isArray(value.products) || value.products.length>30) throw new Error('Use at most 30 products.');
  const ids=new Set();
  result.products=value.products.map(p=>{
    if (!/^[a-z0-9-]{1,40}$/.test(p.id) || ids.has(p.id)) throw new Error('Product IDs must be unique lowercase slugs.');
    ids.add(p.id);
    const item={id:p.id,name:text(p.name,120),description:text(p.description),details:text(p.details,5000),image:image(p.image),badge:text(p.badge,120),quoteOnly:boolean(p.quoteOnly),enabled:boolean(p.enabled),bundleQuantity:number(p.bundleQuantity,100),bundlePriceCents:number(p.bundlePriceCents)};
    item.colors=Array.isArray(p.colors)?p.colors.map(color=>text(color,40).trim()).filter(Boolean):['Silver-white'];
    if (!item.colors.length || item.colors.length>20 || new Set(item.colors).size!==item.colors.length) throw new Error('Use 1–20 unique product colors.');
    item.priceCents=p.priceCents===null?null:number(p.priceCents);
    if (!item.name.trim()) throw new Error('Enter a product name.');
    if (!item.quoteOnly && item.priceCents===null) throw new Error('Set a price or enable price requests.');
    if (item.bundleQuantity===1) throw new Error('A bundle must contain at least two items.');
    return item;
  });
  result.policies={};
  for (const key of ['terms','privacy','cookies','privacy-rights','shipping','returns','payments','safety','ip','accessibility','policies','age-policy','cases','practices']) {
    const policy=value.policies?.[key];
    result.policies[key]={title:text(policy?.title,150),text:text(policy?.text,30000)};
  }
  return result;
}

export function upgradeConfig(config) {
  if (config.schemaVersion >= 3) return config;
  const upgraded=structuredClone(config);
  if (config.schemaVersion >= 2) {
    Object.assign(upgraded,{schemaVersion:3,shippingEnabled:false,orderEmail:'Anvith.mantravadI@gmail.com',supportEmail:'anvith206@gmail.com',paymentMethod:'cash_on_delivery',adultOnly:true,productAge:'13+',deliveryArea:'New Jersey local handoff by confirmation',heroEyebrow:'FOR PARENTS. FOR YOUR TEEN’S NEXT DESK FAVORITE.',heroText:'Get your teen a new desk favorite. Products intended for ages 13+. Adults 18+ order and pay cash at the confirmed local handoff.',bannerText:'GET YOUR TEEN SOMETHING DIFFERENT.',bannerDetail:'Ages 13+ · Adult buyers 18+ · Cash at handoff'});
    return upgraded;
  }
  upgraded.schemaVersion=2;
  upgraded.supportEmail='anvith206@gmail.com';
  upgraded.returnDays=30;
  upgraded.zelleQrImage='';
  upgraded.mixBundles=true;
  for (const p of upgraded.products) {
    p.priceCents=400;p.quoteOnly=false;p.bundleQuantity=10;p.bundlePriceCents=3000;p.badge='ANY 10 FOR $30';
    p.colors=p.id==='fidget'?['Silver-white']:['Gold','Silver','Blue','Red','Black','Green'];
    p.details=p.details.replace('and price by text','by text');
  }
  for (const policy of Object.values(upgraded.policies || {})) {
    policy.text=policy.text.replace('This store’s proposed standard return policy','Our standard return policy')
      .replace('Spinning Tops and Spiral Spinners require a confirmed quote before payment until a price is listed.','Every item is $4. Any 10 mixed pieces cost $30. Extra singles are $4 each.')
      .replace('Spinning Top and Spiral Spinner pricing is confirmed by text before payment until a price is listed.','All items are $4 each, or any 10 mixed pieces for $30, with extra singles at $4 each.');
  }
  return upgradeConfig(upgraded);
}
