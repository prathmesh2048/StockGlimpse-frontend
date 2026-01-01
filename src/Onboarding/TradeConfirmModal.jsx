

export default function TradeConfirmModal({
    open,
    onClose,
    onConfirm,
    trades = "X",
    coinsUsed = "X",
    balance = "Y",
    remaining = "Z",
}) {
    if (!open) return null;
    const hasEnoughCoins = balance >= coinsUsed;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative p-4 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all">

                    {/* Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 text-gray-400 bg-transparent hover:bg-gray-100 hover:text-gray-900 rounded-lg text-sm w-8 h-8 flex justify-center items-center transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>

                        <h3 className="mb-3 text-lg font-bold text-gray-900">
                            {hasEnoughCoins ? "Ready to visualize your trades?" : "Not enough coins"}
                        </h3>

                        <div className="text-gray-600 mb-6 text-sm leading-relaxed">
                            {hasEnoughCoins ? (
                                <>
                                    <p>
                                        You're about to visualize{" "}
                                        <span className="font-bold text-gray-900">{trades} trades</span>{" "}
                                        using{" "}
                                        <span className="font-bold text-gray-900">{coinsUsed} coins</span>{" "}
                                        from your{" "}
                                        <span className="font-bold text-gray-900">{balance}-coin</span>{" "}
                                        balance.
                                    </p>
                                    <p className="mt-1 text-emerald-500 font-medium">
                                        You’ll have <span className="underline font-bold text-emerald-600">{remaining} coins</span> left to explore!
                                    </p>
                                </>
                            ) : (
                                <p className="text-gray-700">
                                    You don’t have enough coins to visualize <span className="font-bold">{trades} trades</span>.  
                                    You can check our plans to get more coins and continue exploring.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 text-gray-500 hover:text-gray-700 font-medium text-sm py-2.5 transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={hasEnoughCoins ? onConfirm : () => window.location.href = "/#"}
                                className={`flex-[2] flex items-center justify-center gap-2 text-white bg-emerald-500 hover:bg-emerald-600 focus:ring-4 focus:ring-emerald-200 shadow-lg font-bold rounded-lg text-sm px-5 py-2.5 transition-all`}
                            >
                                {hasEnoughCoins ? "Yes, let's go!" : "See plans"}
                                {hasEnoughCoins && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
