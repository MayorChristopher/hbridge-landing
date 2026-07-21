import React, { useEffect, useState } from 'react';
import { Image, View, StyleProp, ImageStyle } from 'react-native';
import { getSignedFileUrl } from '../utils/recordAccess';

type Request =
  | { context: 'medical_record'; recordId: string }
  | { context: 'conversation_attachment'; messageId: string };

interface Props {
  request: Request;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
  placeholderColor?: string;
}

export default function SignedImage({ request, style, resizeMode = 'cover', placeholderColor = '#EDE9E0' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const key = request.context === 'medical_record' ? request.recordId : request.messageId;

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    getSignedFileUrl(request).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.context, key]);

  if (!url) return <View style={[style, { backgroundColor: placeholderColor }]} />;
  return <Image source={{ uri: url }} style={style} resizeMode={resizeMode} />;
}
