import { Renderer } from '@quake2ts/engine';
import { MenuState } from './types.js';

export function Draw_Menu(renderer: Renderer, state: MenuState, width: number, height: number): void {
  if (!state.activeMenu) {
    return;
  }

  const menu = state.activeMenu;
  const centerX = width / 2;
  const centerY = height / 2;
  const lineHeight = 20;
  const titleY = centerY - (menu.items.length * lineHeight) / 2 - 40;

  // Draw background overlay
  renderer.drawfillRect(0, 0, width, height, [0, 0, 0, 0.7]);

  // Draw title
  renderer.drawCenterString(titleY, menu.title);

  // Draw items
  menu.items.forEach((item, index) => {
    const y = centerY - (menu.items.length * lineHeight) / 2 + index * lineHeight;
    let text = item.label;

    if (item.type === 'input' && item.getValue) {
        text += `: ${item.getValue()}`;
        if (index === state.selectedIndex) {
            text += '_'; // Cursor
        }
    }

    if (index === state.selectedIndex) {
      text = `> ${text} <`;
      // Draw selected item with a different color or indicator
      // For now just using brackets and assuming default color
    }

    renderer.drawCenterString(y, text);
  });
}
