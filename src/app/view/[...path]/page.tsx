import { ViewApp } from '@/components/ViewApp';

interface ViewPathProps {
  params: Promise<{ path: string[] }>;
}

export default async function ViewPath({ params }: ViewPathProps) {
  const { path } = await params;
  const decoded = (path || []).map((seg) => decodeURIComponent(seg));
  return <ViewApp path={decoded} />;
}
