export function createMapSelectPage(maps: string[], onSelect: (map: string) => void) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    container.style.color = 'white';
    container.style.fontFamily = 'sans-serif';

    const title = document.createElement('h1');
    title.textContent = 'Select a Map';
    container.appendChild(title);

    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    container.appendChild(list);

    for (const map of maps) {
        const item = document.createElement('li');
        item.style.margin = '10px';
        const button = document.createElement('button');
        button.textContent = map;
        button.onclick = () => {
            onSelect(map);
            container.remove();
        };
        item.appendChild(button);
        list.appendChild(item);
    }

    document.body.appendChild(container);
}
