from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_knowledge_service
from app.schemas.knowledge import Capability, Platform, Recipe, UIMap
from app.services.knowledge_service import KnowledgeService

router = APIRouter(prefix="/platforms", tags=["knowledge"])


@router.get("", response_model=list[Platform])
async def list_platforms(svc: KnowledgeService = Depends(get_knowledge_service)) -> list[Platform]:
    return await svc.list_platforms()


@router.get("/{platform}/capabilities", response_model=list[Capability])
async def list_capabilities(
    platform: str,
    query: str | None = None,
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> list[Capability]:
    return await svc.list_capabilities(platform, query)


@router.get("/{platform}/recipes/{capability}", response_model=Recipe)
async def get_recipe(
    platform: str,
    capability: str,
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> Recipe:
    recipe = await svc.get_recipe(platform, capability)
    if recipe is None:
        raise HTTPException(status_code=404, detail="recipe not found")
    return recipe


@router.get("/{platform}/ui-map", response_model=UIMap)
async def get_ui_map(
    platform: str,
    region: str | None = None,
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> UIMap:
    ui_map = await svc.get_ui_map(platform, region)
    # Return an empty map (not 404) so the console renders an empty graph cleanly.
    return ui_map or UIMap(platform=platform)
