import uuid
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _generate_share_id():
    return uuid.uuid4().hex[:12]


class GroundModel(db.Model):
    """A Design Ground Model (DGM) with strata and rationale."""

    __tablename__ = "ground_models"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)          # e.g. "EW0414-DGM_11"
    title = db.Column(db.String(300), default="")             # e.g. "South West Corner of MCA COW"
    project = db.Column(db.String(200), default="")
    location = db.Column(db.String(200), default="")
    created_by = db.Column(db.String(100), default="")
    rationale = db.Column(db.Text, default="")                # Design Ground Model Rationale
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
        order_by="Stratum.sort_order",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "title": self.title,
            "project": self.project,
            "location": self.location,
            "created_by": self.created_by,
            "rationale": self.rationale,
            "notes": self.notes,
            "share_id": self.share_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "strata": [s.to_dict() for s in self.strata],
        }


class Stratum(db.Model):
    """A single stratum row in a DGM table, matching the template format."""

    __tablename__ = "strata"

    id = db.Column(db.Integer, primary_key=True)
    ground_model_id = db.Column(
        db.Integer, db.ForeignKey("ground_models.id"), nullable=False
    )
    sort_order = db.Column(db.Integer, default=0)

    # Stratum identity
    stratum_name = db.Column(db.String(200), nullable=False)  # e.g. "Made Ground [1]"
    ref_number = db.Column(db.String(10), default="")         # e.g. "[1]", "[2]"

    # Observed data from GI
    num_points = db.Column(db.String(20), default="")         # No. of Points (top)
    top_level_min = db.Column(db.String(50), default="")      # Top Level Min (m AOD)
    top_level_max = db.Column(db.String(50), default="")      # Top Level Max (m AOD)
    bottom_level_min = db.Column(db.String(50), default="")   # Bottom Level Min (m AOD)
    bottom_level_max = db.Column(db.String(50), default="")   # Bottom Level Max (m AOD)

    # Design values (text to support ranges like "-4.50 to -9.00")
    top_level_design = db.Column(db.String(100), default="")  # Top Level Design (m AOD)
    bottom_level_design = db.Column(db.String(100), default="")  # Bottom Level Design (m AOD)
    thickness_design = db.Column(db.String(100), default="")  # Thickness Design (m)

    # Notes / rationale for this stratum
    stratum_notes = db.Column(db.Text, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "sort_order": self.sort_order,
            "stratum_name": self.stratum_name,
            "ref_number": self.ref_number,
            "num_points": self.num_points,
            "top_level_min": self.top_level_min,
            "top_level_max": self.top_level_max,
            "bottom_level_min": self.bottom_level_min,
            "bottom_level_max": self.bottom_level_max,
            "top_level_design": self.top_level_design,
            "bottom_level_design": self.bottom_level_design,
            "thickness_design": self.thickness_design,
            "stratum_notes": self.stratum_notes,
        }
