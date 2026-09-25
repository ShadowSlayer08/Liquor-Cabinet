package com.shadowslayer.liquorcabinet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalAppPlugin.class);
        registerPlugin(WebRenderPlugin.class);
        registerPlugin(OrderBubblePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
