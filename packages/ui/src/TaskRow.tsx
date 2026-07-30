import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Badge } from './Badge.js';
import { Checkbox } from './Checkbox.js';
import { SourcePill } from './SourcePill.js';
import type { BrandKey } from './brand-icons.js';

/** Copy for the two swipe tracks. Without it the row has no gestures at all. */
export type TaskRowSwipeLabels = {
    snooze: string;
    delete: string;
};

type TaskRowProps = {
    title: string;
    source?: { brand?: BrandKey; label: string };
    due?: { label: string; overdue?: boolean };
    priorityLabel?: string;
    /** Loud only for the top priority; everything else stays neutral. */
    priorityTone?: 'warn' | 'neutral';
    completed: boolean;
    /** A write is in flight. The row dims and holds still; it never guesses the outcome. */
    pending?: boolean;
    onToggle: (completed: boolean) => void;
    onOpen?: () => void;
    /** Fires when a swipe right is released past the threshold. */
    onSnooze?: () => void;
    /** Revealed by swiping left. Never fires on release: the button has to be tapped. */
    onDelete?: () => void;
    swipeLabels?: TaskRowSwipeLabels;
};

/** Horizontal travel before the gesture takes the axis away from vertical scrolling. */
const AXIS_LOCK_PX = 8;

/** Releasing past this to the right snoozes. */
const SNOOZE_THRESHOLD_PX = 88;

/** Releasing past this to the left parks the row open on the delete track. */
const DELETE_REVEAL_PX = 96;

const MAX_TRAVEL_PX = 120;

/** One task in a list. Presentational: it knows nothing about the API or the query cache. */
export function TaskRow({
    title,
    source,
    due,
    priorityLabel,
    priorityTone = 'neutral',
    completed,
    pending = false,
    onToggle,
    onOpen,
    onSnooze,
    onDelete,
    swipeLabels,
}: TaskRowProps): React.JSX.Element {
    const rowRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<{ x: number; y: number; locked: boolean } | null>(null);
    // The offset is mirrored in a ref because pointermove and pointerup can arrive in the
    // same task, and the release handler would otherwise read the pre-drag render's value.
    const offsetRef = useRef(0);
    const [offset, setOffset] = useState(0);
    const [parked, setParked] = useState(false);

    const canSnooze = Boolean(swipeLabels && onSnooze && !pending);
    const canDelete = Boolean(swipeLabels && onDelete && !pending);

    useEffect(() => {
        if (!parked) return;

        // Only one row stays open at a time, and anything else the user does puts it back.
        // Delete is left one deliberate tap away rather than armed behind a stray gesture.
        const close = (): void => {
            setParked(false);
            travelTo(0);
        };

        const onPointerDown = (event: PointerEvent): void => {
            if (rowRef.current?.contains(event.target as Node)) return;

            close();
        };

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') close();
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [parked]);

    useEffect(() => {
        if (!pending) return;

        setParked(false);
        travelTo(0);
    }, [pending]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        if (!canSnooze && !canDelete) return;

        gestureRef.current = { x: event.clientX, y: event.clientY, locked: false };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
        const gesture = gestureRef.current;

        if (!gesture) return;

        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;

        if (!gesture.locked) {
            // A gesture that starts vertical belongs to the scroller, and never comes back.
            if (Math.abs(dy) > Math.abs(dx)) {
                gestureRef.current = null;
                return;
            }

            if (Math.abs(dx) < AXIS_LOCK_PX) return;

            gesture.locked = true;
        }

        travelTo(clampTravel({ dx, canSnooze, canDelete }));
    };

    const handlePointerUp = (): void => {
        const locked = gestureRef.current?.locked === true;

        gestureRef.current = null;

        if (!locked) return;

        const travelled = offsetRef.current;

        if (onSnooze && travelled > SNOOZE_THRESHOLD_PX) {
            travelTo(0);
            onSnooze();
            return;
        }

        if (onDelete && travelled < -DELETE_REVEAL_PX) {
            setParked(true);
            travelTo(-DELETE_REVEAL_PX);
            return;
        }

        setParked(false);
        travelTo(0);
    };

    function travelTo(next: number): void {
        offsetRef.current = next;
        setOffset(next);
    }

    const dragging = gestureRef.current?.locked === true;

    return (
        <div ref={rowRef} className="relative overflow-hidden border-b border-hair last:border-b-0">
            {canSnooze && swipeLabels && (
                <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-accent text-[11px] font-medium text-accent-fg"
                >
                    {swipeLabels.snooze}
                </span>
            )}
            {canDelete && swipeLabels && (
                <button
                    type="button"
                    onClick={onDelete}
                    tabIndex={parked ? 0 : -1}
                    aria-hidden={!parked}
                    className="absolute inset-y-0 right-0 w-24 cursor-pointer bg-warn-bg text-[11px] font-medium text-warn focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                    {swipeLabels.delete}
                </button>
            )}
            <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={offset ? { transform: `translateX(${offset}px)` } : undefined}
                className={clsx(
                    'relative grid touch-pan-y grid-cols-[18px_1fr_auto] items-center gap-3 bg-panel px-3',
                    'py-[var(--ctm-row-y)] transition-opacity duration-press',
                    !dragging && 'motion-safe:transition-transform motion-safe:duration-press',
                    pending && 'opacity-55',
                )}
            >
                <Checkbox checked={completed} onChange={onToggle} label={title} disabled={pending} />
                <button
                    type="button"
                    onClick={onOpen}
                    disabled={!onOpen}
                    className={clsx(
                        // The row is 44px on a phone; the label has to fill it rather than
                        // leaving a 20px strip of text as the only way in.
                        'min-h-11 self-stretch truncate text-left text-[13.5px] text-fg md:min-h-0',
                        onOpen && 'cursor-pointer hover:underline',
                        completed && 'line-through text-muted',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    )}
                >
                    {title}
                </button>
                <span className="flex items-center gap-2 whitespace-nowrap text-[11px] tabular-nums">
                    {priorityLabel && (
                        <Badge variant={priorityTone === 'warn' ? 'priority' : 'neutral'}>{priorityLabel}</Badge>
                    )}
                    {source && <SourcePill brand={source.brand} label={source.label} />}
                    {due && (
                        <span className={clsx(due.overdue ? 'rounded-[4px] bg-warn-bg px-2 py-0.5 text-warn' : 'text-muted')}>
                            {due.label}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
}

/** Keeps the row from travelling towards a track that has no action behind it. */
function clampTravel({ dx, canSnooze, canDelete }: { dx: number; canSnooze: boolean; canDelete: boolean }): number {
    if (dx > 0) return canSnooze ? Math.min(dx, MAX_TRAVEL_PX) : 0;

    return canDelete ? Math.max(dx, -MAX_TRAVEL_PX) : 0;
}
