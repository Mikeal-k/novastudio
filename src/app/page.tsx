import { Header } from "@/components/lovart-clone/Header";
import { HeroSection } from "@/components/lovart-clone/HeroSection";
import { ShowcaseGrid } from "@/components/lovart-clone/ShowcaseGrid";
import { SystemThinking } from "@/components/lovart-clone/SystemThinking";
import { FeatureSection } from "@/components/lovart-clone/FeatureSection";
import { CTASection } from "@/components/lovart-clone/CTASection";
import { Footer } from "@/components/lovart-clone/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ShowcaseGrid />
        <SystemThinking />
        <FeatureSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
