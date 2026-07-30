import Claude from './assets/brands/claude.svg?react';
import Cursor from './assets/brands/cursor.svg?react';
import Discord from './assets/brands/discord.svg?react';
import GoogleTasks from './assets/brands/google-tasks.svg?react';
import Mcp from './assets/brands/mcp.svg?react';
import Notion from './assets/brands/notion.svg?react';
import Todoist from './assets/brands/todoist.svg?react';

/**
 * Brand marks live in `src/assets/brands` and are inlined at build time, so they stay
 * crisp at any size and can adapt to the theme. Marks whose brand colour is black are
 * drawn in `currentColor` — they would vanish in dark mode otherwise. Google Tasks uses
 * Google's four-colour "G" instead of the Tasks tick, which reads as a generic checkmark
 * at icon sizes. Paths are from simple-icons (CC0-1.0); ChatGPT and VS Code were
 * withdrawn from that set, so they stay as bitmaps.
 */
export type BrandKey =
    | 'todoist'
    | 'google_tasks'
    | 'notion'
    | 'discord'
    | 'claude'
    | 'cursor'
    | 'mcp'
    | 'chatgpt'
    | 'vscode';

type SvgComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

type BrandIcon = { kind: 'vector'; Svg: SvgComponent } | { kind: 'image'; src: string };

export const BRAND_ICONS: Record<BrandKey, BrandIcon> = {
    todoist: { kind: 'vector', Svg: Todoist },
    google_tasks: { kind: 'vector', Svg: GoogleTasks },
    notion: { kind: 'vector', Svg: Notion },
    discord: { kind: 'vector', Svg: Discord },
    claude: { kind: 'vector', Svg: Claude },
    cursor: { kind: 'vector', Svg: Cursor },
    mcp: { kind: 'vector', Svg: Mcp },
    chatgpt: { kind: 'image', src: '/favicons/chatgpt.png' },
    vscode: { kind: 'image', src: '/favicons/vscode.png' },
};
