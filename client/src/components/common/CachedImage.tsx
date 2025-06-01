import React, { useEffect, useState } from 'react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
}

const imageCache = new Map<string, HTMLImageElement>();

export const CachedImage: React.FC<CachedImageProps> = ({ src, alt, ...props }) => {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

	useEffect(() => {
		if (!src) return;

		// If already cached, use it directly
		if (imageCache.has(src)) {
			setLoadedSrc(src);
			return;
		}

		// Otherwise preload and cache
		const img = new Image();
		img.src = src;
		img.onload = () => {
			imageCache.set(src, img);
			setLoadedSrc(src);
		};
	}, [src]);

	if (!loadedSrc) {
		return null; // or return a placeholder/spinner
	}

	return <img src={loadedSrc} alt={alt} {...props} />;
};
