import { useState } from 'react';

const useCopyToClipboard = () => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => {
                    setCopied(false);
                }, 2000);
                return;
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const copied = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (!copied) {
                    throw new Error('Unable to copy text');
                }

                setCopied(true);
                setTimeout(() => {
                    setCopied(false);
                }, 2000);
            }
        } catch (error) {
            console.error('Error copying text to clipboard:', error);
            setCopied(false);
        }
    };

    return { copied, copyToClipboard };
};

export default useCopyToClipboard;
