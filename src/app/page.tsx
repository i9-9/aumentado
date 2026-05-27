import { HeroDefault } from "@/components/home/HeroDefault";
import { HomeLayout } from "@/components/home/HomeLayout";

export default function Home() {
  return <HomeLayout hero={<HeroDefault />} />;
}
