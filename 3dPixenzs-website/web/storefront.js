const store = window.STORE_CONFIG;
const html = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function renderStore() {
  document.title=store.brand+' | Prints worth picking up.';
  const style=document.documentElement.style;
  style.setProperty('--store-background',store.colors.background);
  style.setProperty('--store-text',store.colors.text);
  style.setProperty('--store-accent',store.colors.accent);
  style.setProperty('--store-banner',store.colors.banner);
  style.setProperty('--store-columns',store.columns);
  document.body.dataset.font=store.font;
  document.body.dataset.heroLayout=store.heroLayout;
  document.body.dataset.cardStyle=store.cardStyle;
  document.querySelectorAll('.brand').forEach(el=>el.innerHTML=html(store.brand)+'<span>'+html(store.tagline)+'</span>');
  document.querySelector('.footer-wordmark').textContent=store.brand;
  document.querySelector('.footer-top p').textContent=store.footerText;
  const promo=document.querySelector('.promo');
  promo.textContent=store.promoText;
  document.querySelector('.hero-copy .eyebrow').textContent=store.heroEyebrow;
  document.querySelector('.hero-copy h1').innerHTML=store.heroTitle.split('\n').map(html).join('<br>');
  document.querySelector('.hero-copy>p:not(.eyebrow)').textContent=store.heroText;
  document.getElementById('hero-img').src=store.heroImage;
  document.querySelector('.hero-note').textContent=store.shippingEnabled?'Shipping available by confirmation. Pay cash on delivery.':'Local handoff by confirmation. No parcel shipping. Pay cash when you receive your order.';
  document.getElementById('welcome-form').hidden=!store.emailOffer||!store.couponEnabled;
  document.getElementById('welcome-result').hidden=true;
  const benefit=document.querySelector('.benefits');
  benefit.innerHTML='<span>PRODUCTS INTENDED FOR AGES 13+</span><span>ADULT BUYERS 18+</span><span>CASH AT HANDOFF</span>';
  const banner=document.querySelector('.campaign-banner');
  banner.querySelector('p').innerHTML=html(store.bannerText)+' <span>'+html(store.bannerDetail)+'</span>';
  document.querySelector('.section-title h2').textContent=store.collectionTitle;
  document.querySelector('.category-tabs').innerHTML='<button class="category-tab active" data-category="all" aria-pressed="true">SHOP ALL</button>'+store.products.filter(p=>p.enabled).map(p=>'<button class="category-tab" data-category="'+p.id+'" aria-pressed="false">'+html(p.name.toUpperCase())+'</button>').join('');
  document.querySelector('.products').innerHTML=store.products.filter(p=>p.enabled).map(p=>'<article class="product" data-product="'+p.id+'"><div class="product-photo">'+(p.badge?'<span class="tag">'+html(p.badge)+'</span>':'')+'<img src="'+html(p.image)+'" alt="'+html(p.name)+' product visualization" loading="lazy"><button class="detail-link" data-detail="'+p.id+'">Explore the print</button></div><div class="product-heading"><h3>'+html(p.name)+'</h3><strong>'+(p.quoteOnly?'Request price':dollars(p.priceCents))+'</strong></div><p>'+html(p.description)+'</p>'+(p.colors?.length>1?'<label class="field-label" for="color-'+p.id+'">Color</label><select id="color-'+p.id+'" class="product-color">'+p.colors.map(color=>'<option>'+html(color)+'</option>').join('')+'</select>':'<p class="fixed-color">Color · '+html(p.colors?.[0]||'Silver-white')+'</p>')+(p.quoteOnly?'<button class="button wide" data-quote="'+p.id+'">REQUEST PRICE</button>':'<label class="field-label" for="qty-'+p.id+'">Quantity</label><div class="buy-row"><input id="qty-'+p.id+'" type="number" min="1" max="100" value="1" required><button class="button" data-add="'+p.id+'">ADD TO BAG</button></div>')+(p.bundleQuantity&&!p.quoteOnly?'<button class="bundle" data-bundle="'+p.id+'">GET '+p.bundleQuantity+' FOR '+dollars(p.bundlePriceCents)+'</button>':'')+'<p class="fine">Ages 13+ · Adult buyers 18+. Image is a concept visualization.</p></article>').join('')||'<p>New prints are coming soon. Contact us for availability.</p>';
  const featured=store.products.find(p=>p.enabled&&!p.quoteOnly&&p.bundleQuantity);
  const offer=document.querySelector('.offer');
  if (featured) {
    offer.querySelector('h2').textContent='Any '+featured.bundleQuantity+' prints. One good deal.';
    offer.querySelector('.offer-inner>div>p:not(.eyebrow)').textContent=dollars(featured.bundlePriceCents)+' for any '+featured.bundleQuantity+' pieces. Mix products and colors. NJ sales tax added at checkout.';
    offer.querySelector('del').textContent=dollars(featured.priceCents*featured.bundleQuantity);
    offer.querySelector('.offer-price>span').textContent=dollars(featured.bundlePriceCents);
    offer.querySelector('.offer-price p').textContent=store.couponEnabled?store.couponCode+' takes '+store.couponPercent+'% off products. NJ sales tax is added at checkout.':'NJ sales tax is calculated at checkout.';
    document.getElementById('offer-bundle').dataset.bundle=featured.id;
    document.getElementById('offer-bundle').textContent='BUILD YOUR 10-PACK';
    document.getElementById('offer-bundle').removeAttribute('data-bundle');
    document.getElementById('offer-bundle').onclick=()=>document.getElementById('shop').scrollIntoView({behavior:'smooth'});
  } else offer.hidden=true;
  const steps=document.querySelectorAll('.steps p');
  steps[0].textContent='Choose your prints and colors, then review the bag. Mix any 10 pieces for $30. Extra singles are $4 each.';
  steps[1].textContent='Submit a request with an adult’s contact details. We review availability and arrange a local handoff.';
  steps[2].textContent='Pay the confirmed total, including New Jersey sales tax, in cash when you receive your order.';
  const faq=document.querySelector('.faq');
  faq.querySelectorAll('details').forEach(el=>el.remove());
  const questions=[
    ['Who can order?','Buyers must be 18 or older. Products are intended for users aged 13+. Parents and guardians can shop for their teens.'],
    ['How do I pay?','Pay cash at the confirmed local handoff. No online payment is collected.'],
    ['Do you ship?',store.shippingEnabled?'Shipping is enabled and availability is confirmed before fulfillment.':'No parcel shipping is offered. Local handoff arrangements and availability are confirmed after review.'],
    ['How much tax is added?','These taxable New Jersey orders include 6.625% sales tax, calculated on the discounted product total and taxable delivery charges if applicable.'],
    ['Can I return an item?','Request a return within '+store.returnDays+' days of receiving an unused, undamaged standard product. Contact '+store.supportEmail+'. See the Returns policy for details.']
  ];

  faq.insertAdjacentHTML('beforeend',questions.map(([q,a])=>'<details><summary>'+html(q)+'</summary><p>'+html(a)+'</p></details>').join(''));
  const sections={promo,hero:document.querySelector('.hero'),benefits:benefit,banner,shop:document.getElementById('shop'),offer,how:document.getElementById('how'),faq};
  const main=document.querySelector('main');
  store.sections.forEach(section=>{
    const el=sections[section.id];
    if (section.id!=='promo') main.append(el);
    el.hidden=!section.enabled||(section.id==='offer'&&!featured);
  });
  document.querySelectorAll('a[href^="sms:"]').forEach(link=>link.href='sms:+1'+store.phone);
}
renderStore();
document.querySelectorAll('[data-nav-filter]').forEach(link=>{
 link.addEventListener('click',()=>{
  const button=document.querySelector('[data-category="'+link.dataset.navFilter+'"]');
  button?.click();
 });
});
document.querySelectorAll('a[href="#shop"]:not([data-nav-filter])').forEach(link=>link.addEventListener('click',()=>document.querySelector('[data-category="all"]')?.click()));
