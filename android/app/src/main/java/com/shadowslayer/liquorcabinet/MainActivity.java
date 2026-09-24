package com.shadowslayer.liquorcabinet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
