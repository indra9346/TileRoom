import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SDSLogo } from "@/components/ui/SDSLogo";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative z-10 border-t border-stone-300/70 bg-[#FAF9F5]/85 backdrop-blur-md py-10"
    >
      <div className="container-page flex flex-col items-center justify-between gap-4 text-sm text-stone-500 md:flex-row">
        <div className="flex items-center gap-3">
          <SDSLogo size="sm" variant="dark" subtitle="Virtual Trial Room" />
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-stone-600">
          {[
            { to: "/demos", label: "Demos" },
            { to: "/tiles", label: "Catalog" },
            { to: "/my-visualizations", label: "Designs" },
            { to: "/upload", label: "Visualize" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="link-underline py-1 transition-colors hover:text-stone-900">
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="text-center text-xs text-stone-500">&copy; {new Date().getFullYear()} TileRoom. All rights reserved.</span>
      </div>
      <div className="container-page mt-5 border-t border-stone-100 pt-4 text-center text-[11px] leading-relaxed text-stone-500">
        Realistic visualization preview. Actual lighting conditions, tile batch variations, and grout installation can affect physical finished results.
      </div>
    </motion.footer>
  );
}
