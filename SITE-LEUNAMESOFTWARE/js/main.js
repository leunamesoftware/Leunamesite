(function () {
  'use strict';

  var menuToggle = document.getElementById('menuToggle');
  var categoryNav = document.getElementById('categoryNav');
  var navOverlay = document.getElementById('navOverlay');

  function closeMenu() {
    categoryNav.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function openMenu() {
    categoryNav.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  if (menuToggle && categoryNav && navOverlay) {
    menuToggle.addEventListener('click', function () {
      var isOpen = categoryNav.classList.contains('is-open');
      if (isOpen) closeMenu(); else openMenu();
    });
    navOverlay.addEventListener('click', closeMenu);
    categoryNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeMenu();
    });
  }
})();
