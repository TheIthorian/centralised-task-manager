import { Link, useNavigate } from 'react-router';

/** 404 splash page with neobrutalist styling. */
export function NotFoundPage(): React.JSX.Element {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-6 max-w-sm w-full">
                {/* Big 404 */}
                <div className="text-[8rem] font-black leading-none text-nb-black dark:text-white select-none">
                    404
                </div>

                {/* Broken task card illustration */}
                <div className="w-full border-4 border-nb-black dark:border-white/20 bg-white dark:bg-neutral-900 shadow-[6px_6px_0px_#111] dark:shadow-none p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-nb-black dark:border-white/20 bg-nb-red flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-black text-xs leading-none">✗</span>
                        </div>
                        <span className="font-bold line-through text-nb-grey dark:text-neutral-500 text-sm">
                            find this page
                        </span>
                    </div>
                </div>

                {/* Copy */}
                <div className="text-center">
                    <p className="font-black uppercase text-nb-black dark:text-white text-lg">
                        This page doesn&apos;t exist.
                    </p>
                    <p className="text-nb-grey dark:text-neutral-400 text-sm mt-1">
                        It was never here. Or it ran away.
                    </p>
                </div>

                {/* CTAs */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center justify-center gap-2 border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2 bg-white dark:bg-neutral-800 text-nb-black dark:text-white shadow-[3px_3px_0px_#111] dark:shadow-none transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer"
                    >
                        ← Back
                    </button>
                    <Link
                        to="/tasks"
                        className="inline-flex items-center justify-center gap-2 border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2 bg-nb-black dark:bg-nb-yellow text-white dark:text-nb-black shadow-[3px_3px_0px_#111] dark:shadow-none transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
                    >
                        Go to Tasks
                    </Link>
                </div>
            </div>
        </div>
    );
}
