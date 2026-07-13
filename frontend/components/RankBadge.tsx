import { Medal } from "lucide-react";

const MEDAL_COLOR = ["text-amber-400", "text-slate-400", "text-orange-400"];

// Menampilkan medali untuk 3 besar, sisanya nomor peringkat biasa.
export default function RankBadge({ index }: { index: number }) {
  if (index < 3) {
    return <Medal className={`w-5 h-5 ${MEDAL_COLOR[index]}`} aria-label={`Peringkat ${index + 1}`} />;
  }
  return <span className="font-semibold text-gray-700">{index + 1}</span>;
}
