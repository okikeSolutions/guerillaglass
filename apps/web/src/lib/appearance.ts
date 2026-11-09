// Runs before paint, independently of React and hosted services. Auto appearance
// follows the OS; explicit preferences remain stable across OS changes.
export const themeInitScript = `(function(){
  var media=window.matchMedia('(prefers-color-scheme: dark)');
  function apply(){
    var stored;
    try{stored=window.localStorage.getItem('theme');}catch(e){}
    var mode=(stored==='light'||stored==='dark')?stored:'auto';
    var resolved=mode==='auto'?(media.matches?'dark':'light'):mode;
    var root=document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(resolved);
    if(mode==='auto'){root.removeAttribute('data-theme');}else{root.setAttribute('data-theme',mode);}
    root.style.colorScheme=resolved;
  }
  apply();
  media.addEventListener('change',apply);
  window.addEventListener('storage',function(event){if(event.key==='theme'||event.key===null){apply();}});
})();`;
