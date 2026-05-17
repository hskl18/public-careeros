#!/usr/bin/env python3
"""Render the CareerOS pipeline eval proof as a publication-quality PNG."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


def _load_results(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _format_dataset_name(name: str) -> str:
    return (
        name.replace("_component", "")
        .replace("_fixture", "")
        .replace("_", " ")
        .title()
        .replace("Linkedin", "LinkedIn")
    )


def render(results_path: Path, output_path: Path) -> None:
    results = _load_results(results_path)
    metrics = results["metrics"]
    datasets = results["byDataset"]

    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 12,
            "axes.titleweight": "bold",
            "axes.labelcolor": "#475569",
            "xtick.color": "#64748b",
            "ytick.color": "#0f172a",
            "figure.dpi": 160,
            "savefig.dpi": 240,
        }
    )

    fig = plt.figure(figsize=(12.8, 7.2), facecolor="#f8fafc")
    grid = fig.add_gridspec(
        2,
        2,
        height_ratios=[0.42, 1.0],
        width_ratios=[1.0, 0.92],
        left=0.13,
        right=0.955,
        top=0.79,
        bottom=0.13,
        hspace=0.34,
        wspace=0.48,
    )

    title = fig.text(
        0.055,
        0.93,
        "CareerOS Pipeline Eval",
        ha="left",
        va="top",
        fontsize=24,
        fontweight="bold",
        color="#0f172a",
    )
    title.set_in_layout(False)
    subtitle = fig.text(
        0.055,
        0.885,
        "Evidence -> extraction -> review gate -> application state",
        ha="left",
        va="top",
        fontsize=12,
        color="#475569",
    )
    subtitle.set_in_layout(False)
    generated = str(results.get("generatedAt", ""))[:10]
    stamp = fig.text(
        0.955,
        0.925,
        f"{results['passed']}/{results['totalCases']} cases passed  |  generated {generated}",
        ha="right",
        va="top",
        fontsize=10.5,
        color="#166534",
        fontweight="bold",
    )
    stamp.set_in_layout(False)

    ax_summary = fig.add_subplot(grid[0, :])
    ax_summary.axis("off")
    summary_box = FancyBboxPatch(
        (0.0, 0.08),
        1.0,
        0.8,
        boxstyle="round,pad=0.016,rounding_size=0.03",
        transform=ax_summary.transAxes,
        linewidth=1.2,
        edgecolor="#bfdbfe",
        facecolor="#ffffff",
    )
    ax_summary.add_patch(summary_box)

    summary_cards = [
        ("Overall", f"{results['passRate']:.1f}%", "all expectations"),
        ("Action routing", f"{metrics[1]['numerator']}/{metrics[1]['denominator']}", "apply / review / ignore"),
        ("Stage extraction", f"{metrics[2]['numerator']}/{metrics[2]['denominator']}", "workflow stage"),
        ("Review gate", f"{metrics[3]['numerator']}/{metrics[3]['denominator']}", "risky cases blocked"),
        ("Mutation safety", f"{metrics[4]['numerator']}/{metrics[4]['denominator']}", "no silent risky writes"),
    ]

    for index, (label, value, note) in enumerate(summary_cards):
        x = 0.035 + index * 0.193
        ax_summary.text(x, 0.62, value, transform=ax_summary.transAxes, fontsize=18, fontweight="bold", color="#2563eb")
        ax_summary.text(x, 0.41, label, transform=ax_summary.transAxes, fontsize=9.5, fontweight="bold", color="#0f172a")
        ax_summary.text(x, 0.25, note, transform=ax_summary.transAxes, fontsize=8.2, color="#64748b")

    ax_metrics = fig.add_subplot(grid[1, 0])
    ax_metrics.set_facecolor("#ffffff")
    for spine in ax_metrics.spines.values():
        spine.set_visible(False)

    labels = [metric["label"] for metric in metrics]
    values = [metric["value"] for metric in metrics]
    y_positions = list(range(len(labels)))
    bars = ax_metrics.barh(y_positions, values, color="#2563eb", height=0.56)
    ax_metrics.set_xlim(0, 105)
    ax_metrics.set_yticks(y_positions)
    ax_metrics.set_yticklabels(labels, fontweight="bold")
    ax_metrics.tick_params(axis="y", labelsize=11)
    ax_metrics.invert_yaxis()
    ax_metrics.set_title("Pass rate by pipeline contract", loc="left", fontsize=13, pad=14, color="#0f172a")
    ax_metrics.grid(axis="x", color="#e2e8f0", linewidth=1)
    ax_metrics.set_axisbelow(True)
    ax_metrics.tick_params(axis="y", length=0)
    ax_metrics.tick_params(axis="x", length=0)
    ax_metrics.set_xticks([0, 25, 50, 75, 100])
    ax_metrics.set_xticklabels(["0", "25", "50", "75", "100%"])

    for bar, metric in zip(bars, metrics):
        ax_metrics.text(
            min(bar.get_width() - 1.8, 98.2),
            bar.get_y() + bar.get_height() / 2,
            f"{metric['numerator']}/{metric['denominator']}",
            va="center",
            ha="right",
            fontsize=9.5,
            color="#ffffff",
            fontweight="bold",
        )

    ax_data = fig.add_subplot(grid[1, 1])
    ax_data.set_facecolor("#ffffff")
    for spine in ax_data.spines.values():
        spine.set_visible(False)

    dataset_label_map = {
        "linkedin_job_postings_component": "LinkedIn jobs",
        "enron_thread_style_component": "Email thread style",
        "synthetic_recruiting_fixture": "Recruiting workflow",
        "fake_vs_real_job_postings_component": "Fraud signal",
        "spamassassin_noise_component": "Inbox noise",
        "resume_dataset_component": "Resume context",
    }
    dataset_labels = [dataset_label_map.get(item["dataset"], _format_dataset_name(item["dataset"])) for item in datasets]
    dataset_cases = [item["cases"] for item in datasets]
    dataset_positions = list(range(len(dataset_labels)))
    colors = ["#1d4ed8", "#2563eb", "#60a5fa", "#14b8a6", "#f59e0b", "#94a3b8"]

    ax_data.barh(dataset_positions, dataset_cases, color=colors[: len(dataset_cases)], height=0.58)
    ax_data.set_xlim(0, max(dataset_cases) + 1.5)
    ax_data.set_yticks(dataset_positions)
    ax_data.set_yticklabels(dataset_labels, fontweight="bold")
    ax_data.tick_params(axis="y", labelsize=10.5)
    ax_data.invert_yaxis()
    ax_data.set_title("Fixture coverage by data source", loc="left", fontsize=13, pad=14, color="#0f172a")
    ax_data.grid(axis="x", color="#e2e8f0", linewidth=1)
    ax_data.set_axisbelow(True)
    ax_data.tick_params(axis="y", length=0)
    ax_data.tick_params(axis="x", length=0)
    ax_data.set_xticks([0, 2, 4, 6])
    ax_data.set_xticklabels(["0", "2", "4", "6"])

    for position, count, dataset in zip(dataset_positions, dataset_cases, datasets):
        ax_data.text(
            count + 0.12,
            position,
            f"{count} cases · {dataset['passRate']:.0f}%",
            va="center",
            ha="left",
            fontsize=9,
            color="#1d4ed8",
            fontweight="bold",
        )

    footnote = fig.text(
        0.055,
        0.045,
        "Scope: judge-safe product-loop eval. It proves bounded evidence routing, extraction, review gating, and mutation safety; it is not a broad live Gmail benchmark.",
        ha="left",
        va="bottom",
        fontsize=8.8,
        color="#64748b",
    )
    footnote.set_in_layout(False)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: render_eval_graph.py <eval/results.json> <docs/media/eval-results.png>", file=sys.stderr)
        return 2
    render(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
