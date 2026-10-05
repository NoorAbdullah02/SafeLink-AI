import { useEffect, useRef } from 'react';

const activeDialogs: HTMLElement[] = [];
const inertLocks = new Map<HTMLElement, { count: number; previous: boolean }>();
let scrollLocks = 0;
let previousOverflow = '';

export function setBaseInert(element: HTMLElement, inert: boolean) {
  const lock = inertLocks.get(element);
  if (lock) lock.previous = inert;
  element.inert = Boolean(lock) || inert;
}

export function useModalFocus<T extends HTMLElement = HTMLElement>(
  onClose: () => void,
  enabled = true,
) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousTabIndex = root.getAttribute('tabindex');
    if (scrollLocks === 0) previousOverflow = document.body.style.overflow;
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    activeDialogs.push(root);
    const inerted: HTMLElement[] = [];
    let branch = root.closest<HTMLElement>('.modal-backdrop') || root;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (
          sibling === branch ||
          !(sibling instanceof HTMLElement) ||
          (root.classList.contains('sidebar') && sibling.classList.contains('menu-backdrop'))
        )
          continue;
        const lock = inertLocks.get(sibling);
        if (lock) lock.count += 1;
        else inertLocks.set(sibling, { count: 1, previous: sibling.inert });
        inerted.push(sibling);
        sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    const controls = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('button,input,a[href],select,textarea,[tabindex]') || [],
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          !element.closest('[inert]') &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== 'hidden',
      );
    root.tabIndex = -1;
    (controls()[0] || root).focus();
    const handle = (event: KeyboardEvent) => {
      if (activeDialogs.at(-1) !== root) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const elements = controls(),
        first = elements[0],
        last = elements.at(-1);
      if (!elements.length) {
        event.preventDefault();
        root.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !elements.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !elements.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      const wasTop = activeDialogs.at(-1) === root;
      const index = activeDialogs.indexOf(root);
      if (index !== -1) activeDialogs.splice(index, 1);
      for (const element of inerted) {
        const lock = inertLocks.get(element);
        if (!lock || --lock.count > 0) continue;
        element.inert = lock.previous;
        inertLocks.delete(element);
      }
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
      if (previousTabIndex === null) root.removeAttribute('tabindex');
      else root.setAttribute('tabindex', previousTabIndex);
      if (wasTop) {
        const active = activeDialogs.at(-1);
        if (
          previous?.isConnected &&
          !previous.closest('[inert]') &&
          (!active || active.contains(previous))
        )
          previous.focus();
        else active?.focus();
      }
    };
  }, [enabled]);
  return ref;
}
