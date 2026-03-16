import csv
import io
import json
from datetime import datetime, timezone

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_file,
)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from config import Config
from models import GroundModel, Stratum, db

# Column definitions used across exports
STRATUM_FIELDS = [
    ("loca_id",       "LOCA_ID"),
    ("geol_top",      "GEOL_TOP (m)"),
    ("geol_base",     "GEOL_BASE (m)"),
    ("thickness",     "Thickness (m)"),
    ("geol_desc",     "GEOL_DESC"),
    ("geol_leg",      "GEOL_LEG"),
    ("geol_geol",     "GEOL_GEOL"),
    ("geol_geo2",     "GEOL_GEO2"),
    ("geol_stat",     "GEOL_STAT"),
    ("geol_bgs",      "GEOL_BGS"),
    ("geol_form",     "GEOL_FORM"),
    ("material_type", "Material Type"),
    ("colour",        "Colour"),
    ("notes",         "Notes"),
]


def _stratum_row(s):
    """Return a list of display values for a Stratum, matching STRATUM_FIELDS order."""
    return [
        s.loca_id,
        f"{s.geol_top:.2f}",
        f"{s.geol_base:.2f}",
        f"{s.thickness:.2f}",
        s.geol_desc,
        s.geol_leg,
        s.geol_geol,
        s.geol_geo2,
        s.geol_stat,
        s.geol_bgs,
        s.geol_form,
        s.material_type,
        s.colour,
        s.notes,
    ]


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        db.create_all()

    # ── Page routes ──────────────────────────────────────────────────────

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/model/<int:model_id>")
    def view_model(model_id):
        return render_template("model.html")

    @app.route("/shared/<share_id>")
    def view_shared(share_id):
        return render_template("model.html", shared=True)

    # ── API: list & create ───────────────────────────────────────────────

    @app.route("/api/models", methods=["GET"])
    def list_models():
        models = GroundModel.query.order_by(GroundModel.updated_at.desc()).all()
        return jsonify([m.to_dict() for m in models])

    @app.route("/api/models", methods=["POST"])
    def create_model():
        data = request.get_json()
        if not data or not data.get("name"):
            return jsonify({"error": "Name is required"}), 400

        model = GroundModel(
            name=data["name"],
            project=data.get("project", ""),
            location=data.get("location", ""),
            created_by=data.get("created_by", ""),
            notes=data.get("notes", ""),
        )
        db.session.add(model)
        db.session.commit()
        return jsonify(model.to_dict()), 201

    # ── API: single model CRUD ───────────────────────────────────────────

    @app.route("/api/models/<int:model_id>", methods=["GET"])
    def get_model(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404
        return jsonify(model.to_dict())

    @app.route("/api/models/<int:model_id>", methods=["PUT"])
    def update_model(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404
        data = request.get_json()
        for field in ("name", "project", "location", "created_by", "notes"):
            if field in data:
                setattr(model, field, data[field])
        model.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify(model.to_dict())

    @app.route("/api/models/<int:model_id>", methods=["DELETE"])
    def delete_model(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404
        db.session.delete(model)
        db.session.commit()
        return jsonify({"ok": True})

    # ── API: shared access ───────────────────────────────────────────────

    @app.route("/api/shared/<share_id>", methods=["GET"])
    def get_shared_model(share_id):
        model = GroundModel.query.filter_by(share_id=share_id).first()
        if not model:
            return jsonify({"error": "Not found"}), 404
        return jsonify(model.to_dict())

    # ── API: strata (layers) ─────────────────────────────────────────────

    @app.route("/api/models/<int:model_id>/strata", methods=["POST"])
    def add_stratum(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Model not found"}), 404
        data = request.get_json()
        if not data or "geol_top" not in data or "geol_base" not in data:
            return jsonify({"error": "geol_top and geol_base are required"}), 400

        stratum = Stratum(
            ground_model_id=model_id,
            loca_id=data.get("loca_id", ""),
            geol_top=float(data["geol_top"]),
            geol_base=float(data["geol_base"]),
            geol_desc=data.get("geol_desc", ""),
            geol_leg=data.get("geol_leg", ""),
            geol_geol=data.get("geol_geol", ""),
            geol_geo2=data.get("geol_geo2", ""),
            geol_stat=data.get("geol_stat", ""),
            geol_bgs=data.get("geol_bgs", ""),
            geol_form=data.get("geol_form", ""),
            material_type=data.get("material_type", ""),
            colour=data.get("colour", ""),
            notes=data.get("notes", ""),
        )
        db.session.add(stratum)
        model.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify(stratum.to_dict()), 201

    @app.route("/api/strata/<int:stratum_id>", methods=["PUT"])
    def update_stratum(stratum_id):
        stratum = db.session.get(Stratum, stratum_id)
        if not stratum:
            return jsonify({"error": "Not found"}), 404
        data = request.get_json()
        float_fields = {"geol_top", "geol_base"}
        for field in (
            "loca_id", "geol_top", "geol_base", "geol_desc", "geol_leg",
            "geol_geol", "geol_geo2", "geol_stat", "geol_bgs", "geol_form",
            "material_type", "colour", "notes",
        ):
            if field in data:
                val = float(data[field]) if field in float_fields else data[field]
                setattr(stratum, field, val)
        stratum.ground_model.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify(stratum.to_dict())

    @app.route("/api/strata/<int:stratum_id>", methods=["DELETE"])
    def delete_stratum(stratum_id):
        stratum = db.session.get(Stratum, stratum_id)
        if not stratum:
            return jsonify({"error": "Not found"}), 404
        stratum.ground_model.updated_at = datetime.now(timezone.utc)
        db.session.delete(stratum)
        db.session.commit()
        return jsonify({"ok": True})

    # ── Export: JSON ─────────────────────────────────────────────────────

    @app.route("/api/models/<int:model_id>/export/json")
    def export_json(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404
        data = model.to_dict()
        data.pop("id")
        for s in data["strata"]:
            s.pop("id")
        buf = io.BytesIO(json.dumps(data, indent=2).encode("utf-8"))
        filename = f"{model.name.replace(' ', '_')}_ground_model.json"
        return send_file(buf, mimetype="application/json", as_attachment=True, download_name=filename)

    # ── Export: CSV ──────────────────────────────────────────────────────

    @app.route("/api/models/<int:model_id>/export/csv")
    def export_csv(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([label for _, label in STRATUM_FIELDS])
        for s in model.strata:
            writer.writerow(_stratum_row(s))
        output = io.BytesIO(buf.getvalue().encode("utf-8"))
        filename = f"{model.name.replace(' ', '_')}_ground_model.csv"
        return send_file(output, mimetype="text/csv", as_attachment=True, download_name=filename)

    # ── Export: PDF ──────────────────────────────────────────────────────

    @app.route("/api/models/<int:model_id>/export/pdf")
    def export_pdf(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=landscape(A4), leftMargin=10 * mm, rightMargin=10 * mm
        )
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph(f"Tabulated Ground Model: {model.name}", styles["Title"]))
        info_parts = []
        if model.project:
            info_parts.append(f"<b>Project:</b> {model.project}")
        if model.location:
            info_parts.append(f"<b>Location:</b> {model.location}")
        if model.created_by:
            info_parts.append(f"<b>Created by:</b> {model.created_by}")
        if model.notes:
            info_parts.append(f"<b>Notes:</b> {model.notes}")
        for part in info_parts:
            elements.append(Paragraph(part, styles["Normal"]))
        elements.append(Spacer(1, 8 * mm))

        headers = [label for _, label in STRATUM_FIELDS]
        table_data = [headers]
        for s in model.strata:
            table_data.append(_stratum_row(s))

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7),
            ("FONTSIZE", (0, 1), (-1, -1), 7),
            ("ALIGN", (1, 0), (3, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ecf0f1")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(table)
        doc.build(elements)
        buf.seek(0)
        filename = f"{model.name.replace(' ', '_')}_ground_model.pdf"
        return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)

    # ── Export: Word (DOCX) ──────────────────────────────────────────────

    @app.route("/api/models/<int:model_id>/export/docx")
    def export_docx(model_id):
        model = db.session.get(GroundModel, model_id)
        if not model:
            return jsonify({"error": "Not found"}), 404

        doc = Document()
        doc.add_heading(f"Tabulated Ground Model: {model.name}", level=1)

        # Project info table
        if any([model.project, model.location, model.created_by]):
            info_table = doc.add_table(rows=0, cols=2)
            info_table.style = "Light Shading"
            if model.project:
                row = info_table.add_row()
                row.cells[0].text = "Project"
                row.cells[1].text = model.project
            if model.location:
                row = info_table.add_row()
                row.cells[0].text = "Location"
                row.cells[1].text = model.location
            if model.created_by:
                row = info_table.add_row()
                row.cells[0].text = "Created by"
                row.cells[1].text = model.created_by
            if model.notes:
                row = info_table.add_row()
                row.cells[0].text = "Notes"
                row.cells[1].text = model.notes
            doc.add_paragraph()

        # Strata table
        headers = [label for _, label in STRATUM_FIELDS]
        table = doc.add_table(rows=1, cols=len(headers))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True

        # Header row
        header_row = table.rows[0]
        for i, header in enumerate(headers):
            cell = header_row.cells[i]
            cell.text = header
            para = cell.paragraphs[0]
            run = para.runs[0]
            run.bold = True
            run.font.size = Pt(8)
            run.font.color.rgb = RGBColor(255, 255, 255)
            from docx.oxml.ns import qn
            shading = cell._element.get_or_add_tcPr()
            shading_elm = shading.makeelement(
                qn("w:shd"),
                {qn("w:fill"): "2C3E50", qn("w:val"): "clear"},
            )
            shading.append(shading_elm)

        # Data rows
        for s in model.strata:
            row = table.add_row()
            for i, val in enumerate(_stratum_row(s)):
                cell = row.cells[i]
                cell.text = str(val)
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(8)

        # Set section to landscape
        section = doc.sections[0]
        new_width, new_height = section.page_height, section.page_width
        section.page_width = new_width
        section.page_height = new_height
        section.left_margin = Inches(0.5)
        section.right_margin = Inches(0.5)

        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        filename = f"{model.name.replace(' ', '_')}_ground_model.docx"
        return send_file(
            buf,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            as_attachment=True,
            download_name=filename,
        )

    # ── Import: JSON / CSV ───────────────────────────────────────────────

    @app.route("/api/models/import", methods=["POST"])
    def import_model():
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400
        file = request.files["file"]
        filename = file.filename or ""

        try:
            if filename.endswith(".json"):
                data = json.load(file)
            elif filename.endswith(".csv"):
                reader = csv.DictReader(io.TextIOWrapper(file, encoding="utf-8"))
                data = {
                    "name": filename.rsplit(".", 1)[0].replace("_", " "),
                    "strata": [],
                }
                for row in reader:
                    data["strata"].append({
                        "loca_id": row.get("LOCA_ID", ""),
                        "geol_top": float(row.get("GEOL_TOP (m)", 0)),
                        "geol_base": float(row.get("GEOL_BASE (m)", 0)),
                        "geol_desc": row.get("GEOL_DESC", ""),
                        "geol_leg": row.get("GEOL_LEG", ""),
                        "geol_geol": row.get("GEOL_GEOL", ""),
                        "geol_geo2": row.get("GEOL_GEO2", ""),
                        "geol_stat": row.get("GEOL_STAT", ""),
                        "geol_bgs": row.get("GEOL_BGS", ""),
                        "geol_form": row.get("GEOL_FORM", ""),
                        "material_type": row.get("Material Type", ""),
                        "colour": row.get("Colour", ""),
                        "notes": row.get("Notes", ""),
                    })
            else:
                return jsonify({"error": "Unsupported file type. Use .json or .csv"}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to parse file: {e}"}), 400

        model = GroundModel(
            name=data.get("name", "Imported Model"),
            project=data.get("project", ""),
            location=data.get("location", ""),
            created_by=data.get("created_by", ""),
            notes=data.get("notes", ""),
        )
        db.session.add(model)
        db.session.flush()

        for sd in data.get("strata", []):
            stratum = Stratum(
                ground_model_id=model.id,
                loca_id=sd.get("loca_id", ""),
                geol_top=float(sd.get("geol_top", 0)),
                geol_base=float(sd.get("geol_base", 0)),
                geol_desc=sd.get("geol_desc", ""),
                geol_leg=sd.get("geol_leg", ""),
                geol_geol=sd.get("geol_geol", ""),
                geol_geo2=sd.get("geol_geo2", ""),
                geol_stat=sd.get("geol_stat", ""),
                geol_bgs=sd.get("geol_bgs", ""),
                geol_form=sd.get("geol_form", ""),
                material_type=sd.get("material_type", ""),
                colour=sd.get("colour", ""),
                notes=sd.get("notes", ""),
            )
            db.session.add(stratum)

        db.session.commit()
        return jsonify(model.to_dict()), 201

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
