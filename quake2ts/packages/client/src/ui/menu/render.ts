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
<<<<<<< HEAD
<<<<<<< HEAD
  const titleY = centerY - (menu.items.length * lineHeight) / 2 - 40;
=======
  const totalHeight = (menu.items.length * lineHeight) + 40; // Items + title space
  const startY = centerY - totalHeight / 2;
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
  const totalHeight = (menu.items.length * lineHeight) + 40; // Items + title space
  const startY = centerY - totalHeight / 2;
>>>>>>> origin/main

  // Draw background overlay
  renderer.drawfillRect(0, 0, width, height, [0, 0, 0, 0.7]);

  // Draw title
<<<<<<< HEAD
<<<<<<< HEAD
  renderer.drawCenterString(titleY, menu.title);

  // Draw items
  menu.items.forEach((item, index) => {
    const y = centerY - (menu.items.length * lineHeight) / 2 + index * lineHeight;
=======
=======
>>>>>>> origin/main
  // TODO: Use a larger font or a specific title graphic if available
  renderer.drawCenterString(startY, menu.title);

  // Draw items
  menu.items.forEach((item, index) => {
    const y = startY + 40 + index * lineHeight;
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
    let text = item.label;

    if (item.type === 'input' && item.getValue) {
        text += `: ${item.getValue()}`;
        if (index === state.selectedIndex) {
<<<<<<< HEAD
<<<<<<< HEAD
            text += '_'; // Cursor
        }
    }

    if (index === state.selectedIndex) {
      text = `> ${text} <`;
      // Draw selected item with a different color or indicator
      // For now just using brackets and assuming default color
=======
=======
>>>>>>> origin/main
            // Blinking cursor or static underscore
            const time = Date.now();
            if (Math.floor(time / 500) % 2 === 0) {
               text += '_';
            }
        }
    } else if (item.type === 'toggle' && item.getValue) {
         text += `: ${item.getValue()}`;
    }

    if (index === state.selectedIndex) {
      // Draw cursor arrow to the left
      // Quake 2 typically uses a specific character or graphic for cursor
      // char 13 is often an arrow in Quake fonts
      const cursorChar = 13;
      const charWidth = 8;

      // Calculate text width to position cursor
      const stripped = text.replace(/\^[0-9]/g, '');
      const textWidth = stripped.length * charWidth;
      const textX = (width - textWidth) / 2;

      // Draw cursor to the left of the text
      // renderer.drawChar(textX - 16, y, cursorChar); // Renderer doesn't expose drawChar directly yet, need to check interface
      // Since drawChar isn't on the interface, we'll use a string with just that char
      renderer.drawString(textX - 16, y, String.fromCharCode(cursorChar));
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
    }

    renderer.drawCenterString(y, text);
  });
}
