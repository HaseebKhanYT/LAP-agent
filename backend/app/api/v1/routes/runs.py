from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_run_service
from app.schemas.approval import Approval
from app.schemas.run import Run, RunCreate
from app.services.run_service import RunService

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=Run, status_code=201)
async def create_run(req: RunCreate, svc: RunService = Depends(get_run_service)) -> Run:
    return await svc.start_run(req)


@router.get("", response_model=list[Run])
async def list_runs(svc: RunService = Depends(get_run_service)) -> list[Run]:
    return svc.list_runs()


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: str, svc: RunService = Depends(get_run_service)) -> Run:
    run = svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@router.get("/{run_id}/events")
async def run_events(
    run_id: str, svc: RunService = Depends(get_run_service)
) -> EventSourceResponse:
    if svc.get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")

    async def event_stream():
        async for event in svc.stream_events(run_id):
            # Unnamed SSE messages so the browser's EventSource.onmessage fires.
            yield {"data": json.dumps(event)}

    return EventSourceResponse(event_stream())


@router.get("/{run_id}/approvals", response_model=list[Approval])
async def run_approvals(run_id: str, svc: RunService = Depends(get_run_service)) -> list[Approval]:
    if svc.get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    return svc.list_approvals(run_id)
