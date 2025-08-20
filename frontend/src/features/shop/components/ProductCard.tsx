import React from "react";

type Props = {
  title: string;
  price: number;
  imageUrl?: string;
  onAddToCart?: () => void;
};

export default function ProductCard({ title, price, imageUrl, onAddToCart }: Props) {
  return (
    <div className="border rounded-md overflow-hidden bg-white">
      {imageUrl ? <img src={imageUrl} alt={title} className="h-40 w-full object-cover" /> : <div className="h-40 bg-gray-100" />}
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium line-clamp-2">{title}</div>
        <div className="text-base font-semibold">${price.toFixed(2)}</div>
        <button onClick={onAddToCart} className="text-sm text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-1.5">Add to cart</button>
      </div>
    </div>
  );
}

