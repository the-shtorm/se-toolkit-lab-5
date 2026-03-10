"""Router for analytics endpoints.

Each endpoint performs SQL aggregation queries on the interaction data
populated by the ETL pipeline. All endpoints require a `lab` query
parameter to filter results by lab (e.g., "lab-01").
"""

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import case, func

from app.database import get_session
from app.models.item import ItemRecord
from app.models.interaction import InteractionLog
from app.models.learner import Learner

router = APIRouter()


@router.get("/scores")
async def get_scores(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Score distribution histogram for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item by matching title (e.g. "lab-04" → title contains "Lab 04")
    - Find all tasks that belong to this lab (parent_id = lab.id)
    - Query interactions for these items that have a score
    - Group scores into buckets: "0-25", "26-50", "51-75", "76-100"
      using CASE WHEN expressions
    - Return a JSON array:
      [{"bucket": "0-25", "count": 12}, {"bucket": "26-50", "count": 8}, ...]
    - Always return all four buckets, even if count is 0
    """
    # Find the lab item by matching title (case-insensitive)
    lab_title = lab.replace("-", " ").title()
    res = await session.exec(
      select(ItemRecord).where(ItemRecord.type == "lab", ItemRecord.title.ilike(f"%{lab_title}%"))
    )
    lab_item = res.first()
    if not lab_item:
      return []

    # Get task ids for this lab
    task_res = await session.exec(select(ItemRecord.id).where(ItemRecord.parent_id == lab_item.id))
    task_ids = task_res.all()
    if not task_ids:
      # return empty buckets
      return [
        {"bucket": b, "count": 0}
        for b in ("0-25", "26-50", "51-75", "76-100")
      ]

    # Bucketize scores
    bucket_case = case(
      (InteractionLog.score <= 25, "0-25"),
      (InteractionLog.score <= 50, "26-50"),
      (InteractionLog.score <= 75, "51-75"),
      else_="76-100",
    )

    q = (
      select(bucket_case.label("bucket"), func.count(InteractionLog.id).label("count"))
      .where(InteractionLog.item_id.in_(task_ids))
      .group_by(bucket_case)
    )
    rows = await session.exec(q)
    counts = {r.bucket: int(r.count) for r in rows.all()}

    # Ensure all buckets present
    result = []
    for b in ("0-25", "26-50", "51-75", "76-100"):
      result.append({"bucket": b, "count": counts.get(b, 0)})
    return result


@router.get("/pass-rates")
async def get_pass_rates(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-task pass rates for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - For each task, compute:
      - avg_score: average of interaction scores (round to 1 decimal)
      - attempts: total number of interactions
    - Return a JSON array:
      [{"task": "Repository Setup", "avg_score": 92.3, "attempts": 150}, ...]
    - Order by task title
    """
    lab_title = lab.replace("-", " ").title()
    res = await session.exec(
      select(ItemRecord).where(ItemRecord.type == "lab", ItemRecord.title.ilike(f"%{lab_title}%"))
    )
    lab_item = res.first()
    if not lab_item:
      return []

    # For each child task compute avg score and attempts
    q = (
      select(
        ItemRecord.title.label("task"),
        func.round(func.avg(InteractionLog.score), 1).label("avg_score"),
        func.count(InteractionLog.id).label("attempts"),
      )
      .join(InteractionLog, InteractionLog.item_id == ItemRecord.id, isouter=True)
      .where(ItemRecord.parent_id == lab_item.id)
      .group_by(ItemRecord.title)
      .order_by(ItemRecord.title)
    )

    rows = await session.exec(q)
    result = []
    for r in rows.all():
      avg = r.avg_score
      avg_val = float(avg) if avg is not None else None
      result.append({"task": r.task, "avg_score": avg_val, "attempts": int(r.attempts)})
    return result


@router.get("/timeline")
async def get_timeline(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Submissions per day for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - Group interactions by date (use func.date(created_at))
    - Count the number of submissions per day
    - Return a JSON array:
      [{"date": "2026-02-28", "submissions": 45}, ...]
    - Order by date ascending
    """
    lab_title = lab.replace("-", " ").title()
    res = await session.exec(
      select(ItemRecord).where(ItemRecord.type == "lab", ItemRecord.title.ilike(f"%{lab_title}%"))
    )
    lab_item = res.first()
    if not lab_item:
      return []

    task_res = await session.exec(select(ItemRecord.id).where(ItemRecord.parent_id == lab_item.id))
    task_ids = task_res.all()
    if not task_ids:
      return []

    q = (
      select(func.date(InteractionLog.created_at).label("date"), func.count(InteractionLog.id).label("submissions"))
      .where(InteractionLog.item_id.in_(task_ids))
      .group_by(func.date(InteractionLog.created_at))
      .order_by(func.date(InteractionLog.created_at))
    )

    rows = await session.exec(q)
    result = []
    for r in rows.all():
      result.append({"date": str(r.date), "submissions": int(r.submissions)})
    return result


@router.get("/groups")
async def get_groups(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-group performance for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - Join interactions with learners to get student_group
    - For each group, compute:
      - avg_score: average score (round to 1 decimal)
      - students: count of distinct learners
    - Return a JSON array:
      [{"group": "B23-CS-01", "avg_score": 78.5, "students": 25}, ...]
    - Order by group name
    """
    lab_title = lab.replace("-", " ").title()
    res = await session.exec(
      select(ItemRecord).where(ItemRecord.type == "lab", ItemRecord.title.ilike(f"%{lab_title}%"))
    )
    lab_item = res.first()
    if not lab_item:
      return []

    task_res = await session.exec(select(ItemRecord.id).where(ItemRecord.parent_id == lab_item.id))
    task_ids = task_res.all()
    if not task_ids:
      return []

    # Aggregate by learner group
    q = (
      select(
        Learner.student_group.label("group"),
        func.round(func.avg(InteractionLog.score), 1).label("avg_score"),
        func.count(func.distinct(Learner.id)).label("students"),
      )
      .join(InteractionLog, Learner.id == InteractionLog.learner_id)
      .where(InteractionLog.item_id.in_(task_ids))
      .group_by(Learner.student_group)
      .order_by(Learner.student_group)
    )

    rows = await session.exec(q)
    result = []
    for r in rows.all():
      avg = r.avg_score
      avg_val = float(avg) if avg is not None else None
      result.append({"group": r.group, "avg_score": avg_val, "students": int(r.students)})
    return result
