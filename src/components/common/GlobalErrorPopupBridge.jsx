import { useEffect, useRef } from 'react';
import { useGlobalPopup } from '../../context/GlobalPopupContext';

function extractMessage(node) {
  if (!node) return '';
  return String(node.textContent || '').replace(/\s+/g, ' ').trim();
}

export default function GlobalErrorPopupBridge() {
  const { showError } = useGlobalPopup();
  const consumedNodesRef = useRef(new WeakSet());
  const consumedMessagesRef = useRef(new Map());

  const selectors = [
    'div.border-red-200.bg-red-50',
    'div.border.border-red-200',
    'span.text-red-600',
    'p.text-red-700',
  ];

  function openOrQueue(message) {
    if (!message) return;
    const now = Date.now();
    const lastSeenAt = consumedMessagesRef.current.get(message) || 0;

    // Avoid spamming the same message repeatedly during quick rerenders.
    if (now - lastSeenAt < 1200) return;
    consumedMessagesRef.current.set(message, now);
    showError(message);
  }

  function consumeInlineErrorNode(node) {
    if (!node || consumedNodesRef.current.has(node)) return;

    const message = extractMessage(node);
    if (!message) return;

    consumedNodesRef.current.add(node);
    node.style.display = 'none';
    node.setAttribute('data-error-popup-consumed', 'true');
    openOrQueue(message);
  }

  useEffect(() => {
    const scan = () => {
      const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.hasAttribute('data-error-popup-consumed')) return;

        const className = node.className || '';
        const isLikelyInlineError = className.includes('red') || className.includes('error');
        if (!isLikelyInlineError) return;

        // Ignore action buttons/chips that are styled red but not error messages.
        const tagName = node.tagName.toLowerCase();
        if (tagName === 'button') return;

        consumeInlineErrorNode(node);
      });
    };

    scan();

    const observer = new MutationObserver(() => {
      scan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [showError]);

  return null;
}
