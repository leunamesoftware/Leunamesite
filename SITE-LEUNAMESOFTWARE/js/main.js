(function () {
  'use strict';

  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');
  var navOverlay = document.getElementById('navOverlay');

  function closeMenu() {
    mainNav.classList.remove('is-open');
    navOverlay.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function openMenu() {
    mainNav.classList.add('is-open');
    navOverlay.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  if (menuToggle && mainNav && navOverlay) {
    menuToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.contains('is-open');
      if (isOpen) closeMenu(); else openMenu();
    });
    navOverlay.addEventListener('click', closeMenu);
    mainNav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeMenu();
    });
  }
})();
