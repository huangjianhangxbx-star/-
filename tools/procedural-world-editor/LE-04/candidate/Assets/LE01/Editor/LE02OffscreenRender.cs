using System;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace XingHai.LE01.Editor
{
    // Evidence uses the camera's real URP color/depth attachments, before final blit.
    // Drawing after Camera.Render with GL uses stale SRP matrices and discarded depth.
    public static class LE02OffscreenRender
    {
        sealed class OverlayPass : ScriptableRenderPass
        {
            public Action draw;
            public bool executed;
            public OverlayPass(){renderPassEvent=RenderPassEvent.AfterRenderingTransparents;}
            public override void OnCameraSetup(CommandBuffer cmd,ref RenderingData data)
            {
                var renderer=data.cameraData.renderer;
                ConfigureTarget(renderer.cameraColorTargetHandle,renderer.cameraDepthTargetHandle);
                ConfigureClear(ClearFlag.None,Color.clear);
            }
            public override void Execute(ScriptableRenderContext context,ref RenderingData data)
            {
                var commands=CommandBufferPool.Get("LE02 Surface Range Evidence");
                try{LE02BrushOverlay.DrawToCommands(commands,draw);context.ExecuteCommandBuffer(commands);executed=true;}
                finally{CommandBufferPool.Release(commands);}
            }
        }
        public static void Render(Camera camera,Action overlay=null)
        {
            if(overlay==null){camera.Render();return;}
            var pass=new OverlayPass{draw=overlay};
            Action<ScriptableRenderContext,Camera> begin=(context,current)=>{
                if(current==camera)current.GetUniversalAdditionalCameraData().scriptableRenderer.EnqueuePass(pass);
            };
            RenderPipelineManager.beginCameraRendering+=begin;
            try{camera.Render();if(!pass.executed)throw new InvalidOperationException("URP surface-range evidence pass did not execute");}
            finally{RenderPipelineManager.beginCameraRendering-=begin;}
        }
    }
}
