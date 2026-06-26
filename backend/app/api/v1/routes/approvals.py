from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_run_service
from app.schemas.approval import Approval, ApprovalDecision
from app.services.run_service import RunService

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/{approval_id}/decision", response_model=Approval)
async def decide(
    approval_id: str,
    decision: ApprovalDecision,
    svc: RunService = Depends(get_run_service),
) -> Approval:
    approval = await svc.decide_approval(approval_id, decision)
    if approval is None:
        raise HTTPException(status_code=404, detail="approval not found")
    return approval
