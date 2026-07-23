import { TargetDetailClient } from "./target-detail-client";
export default async function Page({params}:{params:Promise<{projectId:string;targetId:string}>}){const value=await params;return <TargetDetailClient {...value}/>;}
