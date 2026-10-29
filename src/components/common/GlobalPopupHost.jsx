import { useGlobalPopup } from '../../context/GlobalPopupContext';

export default function GlobalPopupHost() {
  const { activeMessage, closePopup } = useGlobalPopup();

  if (!activeMessage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="global-error-popup-title" className="w-full max-w-md rounded-2xl border border-[#f5d7cc] bg-white p-5 shadow-2xl">
        <h3 id="global-error-popup-title" className="text-lg font-bold text-[#7a2914]">Error</h3>
        <p className="mt-2 text-sm text-[#4b3a33]">{activeMessage}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={closePopup}
            className="rounded-xl bg-[#0f8b3d] px-4 py-2 text-sm font-bold text-white hover:bg-[#0c7133]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
