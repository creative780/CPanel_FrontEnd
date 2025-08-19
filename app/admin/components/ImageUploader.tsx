import { useState, useEffect } from 'react';
import Image from 'next/image';

function ImageUploader({ img, onChange }) {
  const [isInvalid, setIsInvalid] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>(img.type);

  useEffect(() => {
    setIsInvalid(false);
  }, [img.value]);

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm">
        <button onClick={() => setMode('upload')} className={mode === 'upload' ? 'text-blue-600 font-medium underline' : 'text-gray-500'}>
          ⬆️ Upload
        </button>
        <button onClick={() => setMode('url')} className={mode === 'url' ? 'text-blue-600 font-medium underline' : 'text-gray-500'}>
          🌐 URL
        </button>
      </div>

      {mode === 'upload' && (
        <input
          type="file"
          accept="image/*"
          className="input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setMode('upload');
              onChange({ type: 'file', value: file.name, file });
            }
          }}
        />
      )}

      {mode === 'url' && (
        <input
          type="text"
          placeholder="https://example.com/image.jpg"
          className="input"
          value={img.type === 'url' ? img.value : ''}
          onChange={(e) => {
            setMode('url');
            setIsInvalid(false);
            onChange({ type: 'url', value: e.target.value, file: null });
          }}
        />
      )}

      {(img.type === 'file' && img.file) && (
        <Image
          src={URL.createObjectURL(img.file)}
          alt="Preview"
          width={100}
          height={60}
          className="rounded border"
        />
      )}

      {(img.type === 'url' && img.value) && (
        isInvalid ? (
          <div className="text-red-600 text-sm font-semibold">❌ Invalid URL</div>
        ) : (
          <img
            src={img.value}
            alt="Preview"
            width={100}
            height={60}
            className="rounded border"
            onError={() => setIsInvalid(true)}
          />
        )
      )}
    </div>
  );
}
export default ImageUploader;