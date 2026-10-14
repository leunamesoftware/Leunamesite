package com.leuname.leunapets.painel;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Baixa um vídeo do painel e guarda na galeria do celular. */
class Midia {
    static Uri salvarVideo(Context c, String url, String titulo) throws Exception {
        String nome = (titulo == null || titulo.trim().isEmpty() ? "video" : titulo.trim()).replaceAll("[^\\p{L}\\p{N} _-]", "").replace(' ', '_');
        if (nome.length() > 50) nome = nome.substring(0, 50);
        nome = nome + "_" + (System.currentTimeMillis() / 1000) + ".mp4";
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(20000); con.setReadTimeout(60000);
        InputStream in = con.getInputStream();
        ContentResolver cr = c.getContentResolver();
        Uri destino; OutputStream out;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Video.Media.DISPLAY_NAME, nome);
            v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            v.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/LeunaPets");
            v.put(MediaStore.Video.Media.IS_PENDING, 1);
            destino = cr.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
            out = cr.openOutputStream(destino);
        } else {
            File pasta = new File(c.getExternalFilesDir(Environment.DIRECTORY_MOVIES), "LeunaPets");
            pasta.mkdirs();
            File f = new File(pasta, nome);
            out = new FileOutputStream(f);
            ContentValues v = new ContentValues();
            v.put(MediaStore.Video.Media.DATA, f.getAbsolutePath());
            v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            destino = null;
            byte[] b = new byte[65536]; int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            out.close(); in.close();
            return cr.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
        }
        byte[] b = new byte[65536]; int n;
        while ((n = in.read(b)) > 0) out.write(b, 0, n);
        out.close(); in.close();
        ContentValues fim = new ContentValues();
        fim.put(MediaStore.Video.Media.IS_PENDING, 0);
        cr.update(destino, fim, null, null);
        return destino;
    }
}
