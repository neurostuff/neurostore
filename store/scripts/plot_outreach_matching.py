"""Plot the outreach map matcher's match rates by map kind, from both calibrations.

One figure, two panels: how often true pairs match and how often unrelated ones
do, for t, z and effect maps, on the NIDM-Results packs (the software's own
peaks) and on real papers (extracted coordinates). The two sets measure slightly
different things, which the figure's note spells out:

- NIDM: each contrast's own map against its own peak table, a known true pair;
  unrelated is the same map against contrasts from other collections.
- Real papers: the share of a paper's analyses whose own collection holds a
  matching map of that kind; unrelated is another paper's collection.

Reads the work directories of calibrate_outreach_matching.py and
calibrate_outreach_matching_nidm.py after their score steps:

    python plot_outreach_matching.py --work /path/to/work --nidm-work /path/to/nidm \\
        --out outreach_matching_by_kind.png

Needs matplotlib. Writes the rates and intervals next to the figure as CSV.
"""

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

import calibrate_outreach_matching as calibration  # noqa: E402
import calibrate_outreach_matching_nidm as nidm_calibration  # noqa: E402

KINDS = ("t", "z", "effect")
KIND_LABELS = {"t": "t maps", "z": "z maps", "effect": "effect maps\n(effect mode)"}
NIDM_KINDS = {"T": "t", "Z": "z", "effect": "effect"}
EXPERIMENTS = ("NIDM", "real papers")
EXPERIMENT_LABELS = {
    "NIDM": "NIDM packs: software's own peaks",
    "real papers": "Real papers: extracted coordinates",
}

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
SERIES = {"NIDM": "#2a78d6", "real papers": "#eb6834"}


def real_paper_rates(matching, work):
    """Own-collection and unrelated-collection match rates per kind, real papers."""
    pairs, maps = calibration.read_rows(work)
    pairs["own"] = pairs["own"].astype(bool)
    kept = calibration.unthresholded(maps)
    keep = set(zip(kept["paper"], kept["map_key"]))
    pairs = pairs[[key in keep for key in zip(pairs["paper"], pairs["map_key"])]]
    papers = json.loads((work / "papers.json").read_text())
    types = calibration.statistic_types(papers)
    kind = [
        types.get(key) if map_kind == calibration.STATISTIC else map_kind
        for key, map_kind in zip(zip(pairs["paper"], pairs["map_key"]), pairs["map_kind"])
    ]
    pairs = pairs.assign(plot_kind=kind)
    rows = []
    for name in KINDS:
        own_best, foreign_best = calibration.analysis_level(
            matching, pairs[pairs["plot_kind"] == name]
        )
        for measure, best in (("true", own_best), ("unrelated", foreign_best)):
            rows.append(rate_row("real papers", name, measure, best, best["paper"], matching))
    return rows


def nidm_rates(matching, work):
    """True-pair and unrelated-pair match rates per kind, NIDM packs."""
    pairs = nidm_calibration.read_pairs(work)
    pairs = pairs[pairs["outcome"] != matching.CANNOT_ASSESS]
    rows = []
    for map_kind, name in NIDM_KINDS.items():
        for measure, column in (("true", "own"), ("unrelated", "negative")):
            sub = pairs[pairs[column] & (pairs["map_kind"] == map_kind)]
            rows.append(rate_row("NIDM", name, measure, sub, sub["collection"], matching))
    return rows


def rate_row(experiment, kind, measure, rows, clusters, matching):
    matched = rows["outcome"] == matching.MATCH
    low, high = calibration.cluster_interval(matched, clusters)
    return {
        "experiment": experiment,
        "kind": kind,
        "measure": measure,
        "rate": matched.mean(),
        "low": low,
        "high": high,
        "n": len(rows),
        "clusters": clusters.nunique(),
    }


def plot(table, path):
    def row(experiment, kind, measure):
        match = table[
            (table["experiment"] == experiment)
            & (table["kind"] == kind)
            & (table["measure"] == measure)
        ]
        return match.iloc[0]

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    fig, axes = plt.subplots(
        1, 2, figsize=(11, 5.6), facecolor=SURFACE,
        gridspec_kw={"width_ratios": [1.35, 1], "wspace": 0.08},
    )
    panels = [
        ("true", "True pairs: how often they match", 1.0, [0, 0.25, 0.5, 0.75, 1.0], "{:.0%}"),
        (
            "unrelated", "Unrelated pairs: how often they match (false match)", 0.10,
            [0, 0.025, 0.05, 0.075, 0.10], "{:.1%}",
        ),
    ]
    offset = {"NIDM": -0.17, "real papers": 0.17}
    for ax, (measure, title, xmax, ticks, label_format) in zip(axes, panels):
        ax.set_facecolor(SURFACE)
        for experiment in EXPERIMENTS:
            color = SERIES[experiment]
            for position, kind in enumerate(KINDS):
                value = row(experiment, kind, measure)
                y = position + offset[experiment]
                ax.plot(
                    [value["low"], value["high"]], [y, y], color=color, lw=2,
                    solid_capstyle="round", alpha=0.45, zorder=2,
                )
                ax.scatter(
                    [value["rate"]], [y], s=70, color=color, edgecolors=SURFACE,
                    linewidths=2, zorder=3,
                )
                # beside the interval, on whichever side has room
                pad = xmax * 0.018
                if value["high"] > xmax * 0.9:
                    x, align = value["low"] - pad, "right"
                else:
                    x, align = value["high"] + pad, "left"
                ax.text(
                    x, y, label_format.format(value["rate"]), ha=align, va="center",
                    color=INK, fontsize=9.5,
                )
        ax.set_xlim(0, xmax * 1.02)
        ax.set_ylim(len(KINDS) - 0.5, -0.55)
        ax.set_xticks(ticks)
        ax.xaxis.set_major_formatter(
            FuncFormatter(lambda v, _, f=label_format: f.format(v).replace(".0%", "%"))
        )
        ax.grid(axis="x", color=GRID, lw=1)
        ax.set_axisbelow(True)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color(AXIS)
        ax.tick_params(axis="x", colors=INK_MUTED, length=0, pad=6)
        ax.tick_params(axis="y", length=0)
        ax.set_title(title, loc="left", color=INK, fontsize=11, pad=10)
        for position in range(1, len(KINDS)):
            ax.axhline(position - 0.5, color=GRID, lw=1, zorder=1)
    axes[0].set_yticks(range(len(KINDS)))
    axes[0].set_yticklabels([KIND_LABELS[k] for k in KINDS], color=INK, fontsize=10.5)
    axes[1].set_yticks([])

    handles = [
        plt.Line2D(
            [], [], marker="o", ls="", markersize=8, color=SERIES[e],
            markeredgecolor=SURFACE, markeredgewidth=2, label=EXPERIMENT_LABELS[e],
        )
        for e in EXPERIMENTS
    ]
    fig.subplots_adjust(top=0.78, bottom=0.16)
    fig.legend(
        handles=handles, loc="upper left", bbox_to_anchor=(0.085, 0.925), ncol=2,
        frameon=False, fontsize=10, labelcolor=INK_SECONDARY, handletextpad=0.3,
        columnspacing=2,
    )
    fig.suptitle(
        "Map-to-coordinate matching by map kind", x=0.09, y=0.985, ha="left",
        color=INK, fontsize=13, fontweight="bold",
    )

    def sizes(experiment, field="n"):
        return [int(row(experiment, kind, "true")[field]) for kind in KINDS]

    nidm_n = sizes("NIDM")
    real_n, real_papers = sizes("real papers"), sizes("real papers", "clusters")
    note = (
        "NIDM: each contrast's own map against the software's own peak table; unrelated = "
        "5 contrasts from other collections. "
        f"Pairs: t {nidm_n[0]}, z {nidm_n[1]}, effect {nidm_n[2]}.\n"
        "Real papers: share of a paper's analyses whose own NeuroVault collection holds a "
        "matching map of that kind; unrelated = another paper's collection.\n"
        f"Analyses: t {real_n[0]} ({real_papers[0]} papers), z {real_n[1]} ({real_papers[1]}), "
        f"effect {real_n[2]} ({real_papers[2]}). Unthresholded maps only. "
        "Lines: 95% interval, bootstrapped over collections / papers."
    )
    fig.text(0.09, 0.075, note, ha="left", va="top", color=INK_MUTED, fontsize=8.5,
             linespacing=1.5)
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=SURFACE)


def main(argv=None):
    import pandas as pd

    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--work", type=Path, required=True,
                        help="calibrate_outreach_matching.py's working directory")
    parser.add_argument("--nidm-work", type=Path, required=True,
                        help="calibrate_outreach_matching_nidm.py's working directory")
    parser.add_argument("--out", type=Path, default=Path("outreach_matching_by_kind.png"))
    args = parser.parse_args(argv)

    matching = calibration.load_matching()
    table = pd.DataFrame(nidm_rates(matching, args.nidm_work)
                         + real_paper_rates(matching, args.work))
    table.to_csv(args.out.with_suffix(".csv"), index=False)
    print(table.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    plot(table, args.out)


if __name__ == "__main__":
    main()
