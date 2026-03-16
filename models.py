import uuid
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _generate_share_id():
    return uuid.uuid4().hex[:12]


class GroundModel(db.Model):
    """A tabulated ground model representing interpreted ground conditions."""

    __tablename__ = "ground_models"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    project = db.Column(db.String(200), default="")
    location = db.Column(db.String(200), default="")
    created_by = db.Column(db.String(100), default="")
    notes = db.Column(db.Text, default="")
    share_id = db.Column(
        db.String(12), unique=True, nullable=False, default=_generate_share_id
    )
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    strata = db.relationship(
        "Stratum",
        backref="ground_model",
        cascade="all, delete-orphan",
        order_by="Stratum.geol_top",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "project": self.project,
            "location": self.location,
            "created_by": self.created_by,
            "notes": self.notes,
            "share_id": self.share_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "strata": [s.to_dict() for s in self.strata],
        }


class Stratum(db.Model):
    """A single stratum/layer, using AGS4 GEOL-aligned field names."""

    __tablename__ = "strata"

    id = db.Column(db.Integer, primary_key=True)
    ground_model_id = db.Column(
        db.Integer, db.ForeignKey("ground_models.id"), nullable=False
    )

    # AGS4 GEOL key/required fields
    loca_id = db.Column(db.String(100), default="")          # LOCA_ID
    geol_top = db.Column(db.Float, nullable=False)            # GEOL_TOP (m)
    geol_base = db.Column(db.Float, nullable=False)           # GEOL_BASE (m)
    geol_desc = db.Column(db.Text, default="")                # GEOL_DESC
    geol_leg = db.Column(db.String(20), default="")           # GEOL_LEG
    geol_geol = db.Column(db.String(50), default="")          # GEOL_GEOL
    geol_geo2 = db.Column(db.String(50), default="")          # GEOL_GEO2
    geol_stat = db.Column(db.String(20), default="")          # GEOL_STAT
    geol_bgs = db.Column(db.String(100), default="")          # GEOL_BGS
    geol_form = db.Column(db.String(200), default="")         # GEOL_FORM

    # Additional practical fields for tabulated ground models
    material_type = db.Column(db.String(100), default="")
    colour = db.Column(db.String(50), default="")
    notes = db.Column(db.Text, default="")

    @property
    def thickness(self):
        return round(self.geol_base - self.geol_top, 3)

    def to_dict(self):
        return {
            "id": self.id,
            "loca_id": self.loca_id,
            "geol_top": self.geol_top,
            "geol_base": self.geol_base,
            "thickness": self.thickness,
            "geol_desc": self.geol_desc,
            "geol_leg": self.geol_leg,
            "geol_geol": self.geol_geol,
            "geol_geo2": self.geol_geo2,
            "geol_stat": self.geol_stat,
            "geol_bgs": self.geol_bgs,
            "geol_form": self.geol_form,
            "material_type": self.material_type,
            "colour": self.colour,
            "notes": self.notes,
        }
