import { TargetVersionDetailClient } from "./version-detail-client";
export default async function Page({params}:{params:Promise<{projectId:string;targetId:string;version:string}>}){const value=await params;return <TargetVersionDetailClient {...value}/>;}
