// Painel LeunaPets: app Android que abre https://pets.leuname.com/painel/ (sempre atualizado, sem navegador).
// Versão: o workflow passa VERSAO_CODIGO/VERSAO_NOME. Assinatura: chave do cofre privado (KEYSTORE_PASSWORD).
plugins { id("com.android.application") }

android {
    namespace = "com.leuname.leunapets.painel"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.leuname.leunapets.painel"
        minSdk = 24
        targetSdk = 34
        versionCode = (System.getenv("VERSAO_CODIGO") ?: "1").toInt()
        versionName = System.getenv("VERSAO_NOME") ?: "1.0"
    }
    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "painel"
            keyPassword = System.getenv("KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (file("release.keystore").exists()) signingConfigs.getByName("release") else null
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
