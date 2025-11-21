export function createLandingPage(onFiles: (files: FileList) => void) {
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
    title.textContent = 'Quake II TS Demo';
    container.appendChild(title);

    const instructions = document.createElement('p');
    instructions.textContent = 'Drag and drop your baseq2/pak0.pak file here';
    container.appendChild(instructions);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    container.appendChild(fileInput);

    const button = document.createElement('button');
    button.textContent = 'Load PAK Files';
    button.onclick = () => fileInput.click();
    container.appendChild(button);

    // Temporary button for verification
    const verifyButton = document.createElement('button');
    verifyButton.textContent = 'Load Map';
    verifyButton.id = 'verify-map-select';
    verifyButton.onclick = () => {
        // Simulate a file list
        const files = new DataTransfer();
        onFiles(files.files);
        container.remove();
    };
    container.appendChild(verifyButton);

    container.ondragover = (event) => {
        event.preventDefault();
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    };

    container.ondragleave = () => {
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    };

    container.ondrop = (event) => {
        event.preventDefault();
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        if (event.dataTransfer?.files) {
            onFiles(event.dataTransfer.files);
            container.remove();
        }
    };

    fileInput.onchange = () => {
        if (fileInput.files) {
            onFiles(fileInput.files);
            container.remove();
        }
    };

    document.body.appendChild(container);
}
