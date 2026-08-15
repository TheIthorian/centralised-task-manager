import { Link, useNavigate } from 'react-router';

/** 404 splash page with neobrutalist styling. */
export function NotFoundPage(): React.JSX.Element {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-6 max-w-sm w-full">
                {/* Big 404 */}
                <div className="text-[8rem] font-semibold leading-none text-fg select-none">404</div>

                {/* Broken task card illustration */}
                <div className="w-full border border-line bg-panel p-4 rounded-ctm">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-line bg-warn flex items-center justify-center flex-shrink-0 rounded-ctm">
                            <span className="text-white font-semibold text-xs leading-none">✗</span>
                        </div>
                        <span className="font-medium line-through text-muted dark:text-neutral-500 text-sm">
                            find this page
                        </span>
                    </div>
                </div>

                {/* Copy */}
                <div className="text-center">
                    <p className="font-semibold text-fg text-lg">
                        This page doesn&apos;t exist.
                    </p>
                    <p className="text-muted dark:text-neutral-400 text-sm mt-1">
                        It was never here. Or it ran away.
                    </p>
                </div>

                {/* CTAs */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center justify-center gap-2 border border-line font-semibold uppercase tracking-[0.12em] text-sm px-4 py-2 bg-panel text-fg transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer rounded-ctm"
                    >
                        ← Back
                    </button>
                    <Link
                        to="/tasks"
                        className="inline-flex items-center justify-center gap-2 border border-line font-semibold uppercase tracking-[0.12em] text-sm px-4 py-2 bg-fg dark:bg-accent text-accent-fg transition-all duration-100 hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none rounded-ctm"
                    >
                        Go to Tasks
                    </Link>
                </div>
            </div>
        </div>
    );
}
