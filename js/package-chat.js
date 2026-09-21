/* Zyntra Package Assistant — manually guided package information. */

// PACKAGE CHAT DATA START
// Edit package names, prices, descriptions, features, notes or active status here.
// Only records with active: true are displayed in the assistant.
const PACKAGE_CHAT_DATA = [
  {
    id: 'starter-trial',
    name: 'STARTER TRIAL PACKAGE',
    displayName: 'Starter Trial',
    price: 'Rs. 8,000',
    billingPeriod: 'Month',
    badge: 'New Client Offer',
    theme: 'cyan',
    accent: '#54d8ff',
    shortDescription: 'Experience the quality of Zyntra Studio’s creative services with an affordable starter plan designed for new clients.',
    features: [
      '05 Creative Social Media Posts',
      '02 Attention-Grabbing Short Videos',
      'Monthly Content Plan',
      'Monthly Performance Report'
    ],
    noteLabel: 'Important note',
    note: 'Available exclusively to new clients for the first two months.',
    active: true
  },
  {
    id: 'starter',
    name: 'STARTER PACKAGE',
    displayName: 'Starter',
    price: 'Rs. 18,000',
    billingPeriod: 'Month',
    badge: 'Starter',
    theme: 'orange',
    accent: '#ff9b54',
    shortDescription: 'A practical monthly content package for small businesses starting their social media journey.',
    features: [
      '10 Social Media Posts (Static)',
      '02 Short Videos/Reels (30–60 Seconds)',
      'Caption Writing',
      'Content Scheduling',
      'FREE Special Days Post, such as a Poya Day post'
    ],
    noteLabel: 'Customisation note',
    note: 'Need something different? Every package can be customised to suit your business.',
    active: true
  },
  {
    id: 'essential',
    name: 'ESSENTIAL PACKAGE',
    displayName: 'Essential',
    price: 'Rs. 29,000',
    billingPeriod: 'Month',
    badge: 'Essential',
    theme: 'magenta',
    accent: '#c86bff',
    shortDescription: 'A balanced monthly content solution for businesses that need consistent posts and video content.',
    features: [
      '15 Social Media Posts (Static)',
      '04 Short Videos/Reels (30–60 Seconds)',
      'Caption Writing',
      'Content Scheduling',
      'FREE Special Days Post, such as a Poya Day post'
    ],
    noteLabel: 'Customisation note',
    note: 'Need something different? Every package can be customised to suit your business.',
    active: true
  },
  {
    id: 'growth',
    name: 'GROWTH PACKAGE',
    displayName: 'Growth',
    price: 'Rs. 46,000',
    billingPeriod: 'Month',
    badge: 'Most Popular',
    theme: 'gold',
    accent: '#ffd45c',
    shortDescription: 'A complete monthly content management package designed to improve brand consistency, engagement and growth.',
    features: [
      '15 Social Media Posts (Graphics and Stories)',
      '08 Short Videos/Reels (30–60 Seconds)',
      'Caption Writing',
      'Content Scheduling',
      'Basic Community Engagement',
      'FREE Special Days Post, such as a Poya Day post',
      'FREE Monthly $10 Ad Boost'
    ],
    noteLabel: 'Customisation note',
    note: 'Need something different? Every package can be customised to suit your business.',
    active: true
  },
  {
    id: 'unlimited-elite',
    name: 'UNLIMITED ELITE PACKAGE',
    displayName: 'Unlimited Elite',
    price: 'Rs. 80,000',
    billingPeriod: 'Month',
    badge: 'Full-Time Partner',
    theme: 'red',
    accent: '#ff6f61',
    shortDescription: 'A high-priority creative partnership for businesses that require continuous social media content and dedicated support.',
    features: [
      'UNLIMITED Social Media Posts',
      'UNLIMITED Video Editing',
      'UNLIMITED Revisions',
      'Priority Workflow',
      'Dedicated Support',
      'Community Engagement',
      'Optimised Content Formats for Facebook, TikTok and YouTube',
      'Regular Trend Monitoring to Keep Content Fresh and Relevant',
      'FREE Special Days Post, such as a Poya Day post'
    ],
    noteLabel: 'Customisation note',
    note: 'Need something different? Every package can be customised to suit your business.',
    active: true
  }
];
// PACKAGE CHAT DATA END

const PACKAGE_CHAT_SERVICE_POLICY = {
  title: 'Deadline Policy',
  paragraphs: [
    'To maintain the highest quality of service, all project briefs, files and requirements should be submitted at least seven days before the expected completion date.',
    'Urgent requests will be considered depending on the existing project schedule and available production time.'
  ],
  reasons: [
    { title: 'Superior Quality', text: 'No rushed work and better attention to detail.' },
    { title: 'Strategic Approach', text: 'Concept-driven content tailored to the brand.' },
    { title: 'Technical Excellence', text: 'Proper time for editing, rendering and professional finishing.' }
  ]
};

(function initializeZyntraPackageAssistant() {
  'use strict';

  if (window.__zyntraPackageAssistantInitialized) return;
  window.__zyntraPackageAssistantInitialized = true;

  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const WHATSAPP_NUMBER = '94706004033';
  const activePackages = PACKAGE_CHAT_DATA.filter(function (item) { return item.active === true; });
  let typingTimer = 0;
  let conversationVersion = 0;
  let hasStarted = false;
  let closeTimer = 0;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  }

  function createSvgIcon(type) {
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const iconShapes = {
      packages: [
        ['path', { d: 'M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z' }],
        ['path', { d: 'm5 7.5 7 3.5 7-3.5M12 11v9' }]
      ],
      restart: [
        ['path', { d: 'M20 11a8 8 0 1 0-2.35 5.65' }],
        ['path', { d: 'M20 5v6h-6' }]
      ],
      minimize: [['path', { d: 'M6 12h12' }]],
      close: [['path', { d: 'm7 7 10 10M17 7 7 17' }]],
      arrow: [['path', { d: 'M5 12h14M14 7l5 5-5 5' }]],
      check: [['path', { d: 'm5 12 4 4L19 6' }]],
      clock: [
        ['circle', { cx: '12', cy: '12', r: '8' }],
        ['path', { d: 'M12 8v4l3 2' }]
      ],
      whatsapp: [
        ['path', { d: 'M20 11.6a8 8 0 0 1-11.85 7L4 20l1.35-4A8 8 0 1 1 20 11.6Z' }],
        ['path', { d: 'M9 8.4c.3 2.6 2.3 4.7 4.9 5.2l1.1-1.1 2 .9' }]
      ]
    };
    (iconShapes[type] || iconShapes.packages).forEach(function (shapeData) {
      const shape = document.createElementNS(SVG_NAMESPACE, shapeData[0]);
      Object.keys(shapeData[1]).forEach(function (key) { shape.setAttribute(key, shapeData[1][key]); });
      svg.appendChild(shape);
    });
    return svg;
  }

  function createIconButton(className, label, iconType) {
    const button = createElement('button', className);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.appendChild(createSvgIcon(iconType));
    return button;
  }

  const root = createElement('div', 'package-chat');
  root.id = 'package-chat';

  const trigger = createElement('button', 'package-chat__trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-controls', 'package-chat-panel');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Open Zyntra Package Assistant');
  trigger.appendChild(createSvgIcon('packages'));
  trigger.appendChild(createElement('span', '', 'View Packages'));

  const panel = createElement('section', 'package-chat__panel');
  panel.id = 'package-chat-panel';
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'package-chat-title');
  panel.setAttribute('aria-describedby', 'package-chat-subtitle');

  const header = createElement('header', 'package-chat__header');
  const identity = createElement('div', 'package-chat__identity');
  const identityIcon = createElement('span', 'package-chat__identity-icon');
  identityIcon.appendChild(createSvgIcon('packages'));
  const titleGroup = createElement('div', 'package-chat__title-group');
  const title = createElement('h2', '', 'Zyntra Package Assistant');
  title.id = 'package-chat-title';
  const subtitle = createElement('p', '', 'Find the right plan for your business');
  subtitle.id = 'package-chat-subtitle';
  titleGroup.append(title, subtitle);
  identity.append(identityIcon, titleGroup);

  const headerActions = createElement('div', 'package-chat__header-actions');
  const restartButton = createIconButton('package-chat__icon-button', 'Restart chat', 'restart');
  const minimizeButton = createIconButton('package-chat__icon-button', 'Minimise chat', 'minimize');
  const closeButton = createIconButton('package-chat__icon-button', 'Close chat', 'close');
  headerActions.append(restartButton, minimizeButton, closeButton);
  header.append(identity, headerActions);

  const messages = createElement('div', 'package-chat__messages');
  messages.id = 'package-chat-messages';
  messages.setAttribute('role', 'log');
  messages.setAttribute('aria-live', 'polite');
  messages.setAttribute('aria-relevant', 'additions text');
  messages.setAttribute('aria-label', 'Package assistant conversation');
  messages.tabIndex = -1;

  const footer = createElement('div', 'package-chat__footer');
  const statusDot = createElement('i');
  statusDot.setAttribute('aria-hidden', 'true');
  footer.append(statusDot, createElement('span', '', 'Guided package assistant — no AI'));

  panel.append(header, messages, footer);
  root.append(panel, trigger);
  document.body.appendChild(root);

  function scrollMessagesToEnd() {
    window.requestAnimationFrame(function () { messages.scrollTop = messages.scrollHeight; });
  }

  function cancelPendingResponse() {
    conversationVersion += 1;
    window.clearTimeout(typingTimer);
  }

  function createAssistantMessage(extraClass) {
    return createElement('div', 'package-chat__message package-chat__message--assistant' + (extraClass ? ' ' + extraClass : ''));
  }

  function appendCustomerMessage(text) {
    const bubble = createElement('div', 'package-chat__message package-chat__message--customer');
    bubble.appendChild(createElement('p', '', text));
    messages.appendChild(bubble);
  }

  function createTypingIndicator() {
    const bubble = createAssistantMessage('package-chat__typing');
    bubble.setAttribute('aria-label', 'Zyntra Package Assistant is preparing package details');
    for (let index = 0; index < 3; index += 1) bubble.appendChild(createElement('i'));
    return bubble;
  }

  function createTextButton(label, className) {
    const button = createElement('button', className, label);
    button.type = 'button';
    return button;
  }

  function renderPackageList() {
    cancelPendingResponse();
    hasStarted = true;
    messages.replaceChildren();

    const welcome = createAssistantMessage('package-chat__welcome');
    welcome.appendChild(createElement('p', 'package-chat__welcome-title', 'Welcome to Zyntra Studio!'));
    welcome.appendChild(createElement('p', '', 'Explore our monthly creative packages below. Select a package to view its complete details.'));
    messages.appendChild(welcome);

    const options = createElement('div', 'package-chat__options');
    activePackages.forEach(function (packageItem) {
      const option = createElement('button', 'package-chat__package-option');
      option.type = 'button';
      option.dataset.packageId = packageItem.id;
      option.style.setProperty('--package-chat-accent', packageItem.accent);
      option.setAttribute('aria-label', 'View details for ' + packageItem.displayName + ', ' + packageItem.price + ' per ' + packageItem.billingPeriod);

      const optionTop = createElement('span', 'package-chat__option-top');
      optionTop.appendChild(createElement('strong', '', packageItem.displayName));
      optionTop.appendChild(createElement('em', '', packageItem.badge));
      const optionBottom = createElement('span', 'package-chat__option-bottom');
      const price = createElement('span', 'package-chat__option-price', packageItem.price);
      price.appendChild(createElement('small', '', ' / ' + packageItem.billingPeriod));
      const indicator = createElement('span', 'package-chat__option-indicator', 'View Details');
      indicator.appendChild(createSvgIcon('arrow'));
      optionBottom.append(price, indicator);
      option.append(optionTop, optionBottom);
      options.appendChild(option);
    });
    messages.appendChild(options);

    const policyButton = createTextButton('View Service Policy', 'package-chat__policy-link');
    policyButton.dataset.packageChatPolicy = 'true';
    policyButton.prepend(createSvgIcon('clock'));
    messages.appendChild(policyButton);
    messages.scrollTop = 0;
  }

  function createDetailMessage(packageItem) {
    const response = createAssistantMessage('package-chat__details');
    response.style.setProperty('--package-chat-accent', packageItem.accent);
    response.tabIndex = -1;

    const meta = createElement('div', 'package-chat__detail-meta');
    meta.appendChild(createElement('span', 'package-chat__detail-badge', packageItem.badge));
    meta.appendChild(createElement('span', 'package-chat__detail-id', packageItem.id));
    response.append(meta, createElement('h3', '', packageItem.name));

    const price = createElement('p', 'package-chat__detail-price', packageItem.price);
    price.appendChild(createElement('span', '', ' / ' + packageItem.billingPeriod));
    response.append(price, createElement('p', 'package-chat__detail-description', packageItem.shortDescription));

    response.appendChild(createElement('h4', '', 'What’s included'));
    const featureList = createElement('ul', 'package-chat__features');
    packageItem.features.forEach(function (feature) {
      const item = createElement('li');
      const icon = createElement('span');
      icon.appendChild(createSvgIcon('check'));
      item.append(icon, createElement('span', '', feature));
      featureList.appendChild(item);
    });
    response.appendChild(featureList);

    const note = createElement('div', 'package-chat__note');
    note.append(createElement('strong', '', packageItem.noteLabel), createElement('p', '', packageItem.note));
    response.appendChild(note);

    const actions = createElement('div', 'package-chat__detail-actions');
    const whatsappButton = createTextButton('Get More Details on WhatsApp', 'package-chat__action package-chat__action--primary');
    whatsappButton.dataset.packageChatWhatsapp = packageItem.id;
    whatsappButton.prepend(createSvgIcon('whatsapp'));
    const otherPackagesButton = createTextButton('View Other Packages', 'package-chat__action package-chat__action--secondary');
    otherPackagesButton.dataset.packageChatList = 'true';
    const policyButton = createTextButton('View Service Policy', 'package-chat__policy-link');
    policyButton.dataset.packageChatPolicy = 'true';
    policyButton.prepend(createSvgIcon('clock'));
    actions.append(whatsappButton, otherPackagesButton, policyButton);
    response.appendChild(actions);
    return response;
  }

  function showPackageDetails(packageItem) {
    if (!packageItem) return;
    cancelPendingResponse();
    const requestVersion = conversationVersion;
    messages.replaceChildren();
    appendCustomerMessage('Show me the ' + packageItem.displayName + ' package.');
    const typing = createTypingIndicator();
    messages.appendChild(typing);
    scrollMessagesToEnd();
    typingTimer = window.setTimeout(function () {
      if (requestVersion !== conversationVersion) return;
      typing.remove();
      messages.appendChild(createDetailMessage(packageItem));
      scrollMessagesToEnd();
    }, 550);
  }

  function createPolicyMessage() {
    const response = createAssistantMessage('package-chat__details package-chat__policy');
    response.tabIndex = -1;
    response.appendChild(createElement('span', 'package-chat__detail-badge', 'Service Policy'));
    response.appendChild(createElement('h3', '', PACKAGE_CHAT_SERVICE_POLICY.title));
    PACKAGE_CHAT_SERVICE_POLICY.paragraphs.forEach(function (paragraph) {
      response.appendChild(createElement('p', 'package-chat__detail-description', paragraph));
    });
    response.appendChild(createElement('h4', '', 'Why this policy exists'));
    const list = createElement('ul', 'package-chat__policy-reasons');
    PACKAGE_CHAT_SERVICE_POLICY.reasons.forEach(function (reason) {
      const item = createElement('li');
      item.append(createElement('strong', '', reason.title + ': '), document.createTextNode(reason.text));
      list.appendChild(item);
    });
    response.appendChild(list);
    const listButton = createTextButton('View Packages', 'package-chat__action package-chat__action--secondary');
    listButton.dataset.packageChatList = 'true';
    response.appendChild(listButton);
    return response;
  }

  function showServicePolicy() {
    cancelPendingResponse();
    const requestVersion = conversationVersion;
    messages.replaceChildren();
    appendCustomerMessage('View Service Policy');
    const typing = createTypingIndicator();
    messages.appendChild(typing);
    scrollMessagesToEnd();
    typingTimer = window.setTimeout(function () {
      if (requestVersion !== conversationVersion) return;
      typing.remove();
      messages.appendChild(createPolicyMessage());
      scrollMessagesToEnd();
    }, 500);
  }

  function openWhatsapp(packageItem) {
    const message = [
      'Hello Zyntra Studio,',
      '',
      'I’m interested in the ' + packageItem.name + ' – ' + packageItem.price + ' / ' + packageItem.billingPeriod + '.',
      '',
      'I would like to get more information about this package and discuss how it can be customised for my business.',
      '',
      'Thank you.'
    ].join('\n');
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  function openChat() {
    window.clearTimeout(closeTimer);
    if (!hasStarted) renderPackageList();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', 'Zyntra Package Assistant is open');
    panel.getBoundingClientRect();
    root.classList.add('is-open');
    window.requestAnimationFrame(function () {
      panel.focus({ preventScroll: true });
    });
  }

  function hideChat(resetConversation) {
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Open Zyntra Package Assistant');
    if (resetConversation) {
      cancelPendingResponse();
      hasStarted = false;
    }
    closeTimer = window.setTimeout(function () {
      panel.hidden = true;
      trigger.focus({ preventScroll: true });
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
  }

  trigger.addEventListener('click', openChat);
  minimizeButton.addEventListener('click', function () { hideChat(false); });
  closeButton.addEventListener('click', function () { hideChat(true); });
  restartButton.addEventListener('click', function () {
    renderPackageList();
    messages.focus({ preventScroll: true });
  });

  messages.addEventListener('click', function (event) {
    const packageButton = event.target.closest('[data-package-id]');
    if (packageButton) {
      showPackageDetails(activePackages.find(function (item) { return item.id === packageButton.dataset.packageId; }));
      return;
    }
    if (event.target.closest('[data-package-chat-list]')) {
      renderPackageList();
      return;
    }
    if (event.target.closest('[data-package-chat-policy]')) {
      showServicePolicy();
      return;
    }
    const whatsappButton = event.target.closest('[data-package-chat-whatsapp]');
    if (whatsappButton) {
      const packageItem = activePackages.find(function (item) { return item.id === whatsappButton.dataset.packageChatWhatsapp; });
      if (packageItem) openWhatsapp(packageItem);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && root.classList.contains('is-open')) {
      event.preventDefault();
      hideChat(false);
    }
  });
}());
