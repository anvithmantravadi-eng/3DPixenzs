(() => {
  if(location.pathname.startsWith('/admin'))return;
  let confirmed=false;
  try{confirmed=sessionStorage.getItem('tactelyx-adult-ack')==='true';}catch{}
  if(confirmed)return;
  const gate=document.createElement('dialog');
  gate.className='age-gate';
  gate.setAttribute('aria-labelledby','adult-title');
  gate.innerHTML='<h2 id="adult-title">Adults shop. Teens enjoy.</h2><p>Products are intended for ages 13+. This store accepts orders from adults aged 18 or older.</p><label class="check-label"><input id="adult-entry" type="checkbox"><span>I confirm I am 18 or older.</span></label><button class="button wide" id="adult-continue" disabled>ENTER STORE</button><button class="bundle" id="adult-decline">I AM UNDER 18</button><p class="fine">A parent or guardian can shop for a teen aged 13+. This is a self-declaration, not identity verification.</p>';
  document.body.append(gate);
  gate.addEventListener('cancel',event=>event.preventDefault());
  gate.querySelector('#adult-entry').onchange=event=>gate.querySelector('#adult-continue').disabled=!event.target.checked;
  gate.querySelector('#adult-continue').onclick=()=>{if(!gate.querySelector('#adult-entry').checked)return;try{sessionStorage.setItem('tactelyx-adult-ack','true');}catch{}window.tactelyxAdultConfirmed=true;gate.close();};
  gate.querySelector('#adult-decline').onclick=()=>{gate.innerHTML='<h2>Please ask an adult to shop.</h2><p>This store’s forms and ordering are for buyers aged 18 or older. A parent or guardian can visit to select products for a teen aged 13+.</p>';};
  gate.showModal();
})();
