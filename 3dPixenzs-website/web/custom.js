document.getElementById('brief').addEventListener('submit', event => {
  event.preventDefault();
  const fields = [...new FormData(event.currentTarget)];
  const content = ['Custom print project brief', ...fields.map(([label, value]) => label + '\n' + (value.trim() || 'Open to suggestions'))].join('\n\n');
  const url = URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'strata-custom-print-brief.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  document.getElementById('brief-status').textContent = 'Project brief downloaded.';
});
