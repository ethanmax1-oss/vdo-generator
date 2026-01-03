import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedImage } from '../types';

interface ImageUploadProps {
  images: UploadedImage[];
  setImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
  label: string;
  maxImages?: number;
  single?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ images, setImages, label, maxImages = 5, single = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages: UploadedImage[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/')) {
            const base64 = await convertToBase64(file);
            newImages.push({
                id: Math.random().toString(36).substr(2, 9),
                url: URL.createObjectURL(file),
                base64Data: base64,
                mimeType: file.type,
                name: file.name
            });
        }
      }

      if (single) {
        setImages([newImages[0]]);
      } else {
        setImages(prev => [...prev, ...newImages].slice(0, maxImages));
      }
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Max {maxImages}</span>
      </div>
      
      <div className="flex flex-wrap gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative group w-20 h-28 rounded-lg overflow-hidden border border-gray-700 bg-gray-800 shadow-sm">
            <img src={img.url} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-28 rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-500 hover:bg-gray-800/50 flex flex-col items-center justify-center cursor-pointer transition-colors"
          >
            <Upload size={18} className="text-gray-400 mb-1" />
            <span className="text-[10px] text-gray-500 text-center px-1">Add Anchor</span>
          </div>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple={!single}
        className="hidden"
      />
    </div>
  );
};