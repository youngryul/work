package com.youngryul.potatobuddy

import android.app.Application
import com.youngryul.potatobuddy.data.AppContainer

class PotatoBuddyApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        container = AppContainer(this)
    }

    companion object {
        lateinit var instance: PotatoBuddyApp
            private set
    }
}
