use reqwest::header::{ COOKIE, LOCATION, SET_COOKIE };
use std::collections::HashMap;
use std::time::Duration;

use super::constants::VTOP_BASE_URL;

const SECTIGO_INTERMEDIATE: &[u8] = include_bytes!("sectigo_intermediate.pem");

pub fn build_http_client() -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::ACCEPT,
                reqwest::header::HeaderValue::from_static(
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                )
            );
            headers
        });

    // 100% Secure Fix: Inject the missing VTOP intermediate certificate 
    // directly so the Rust client can bridge the trust chain.
    if let Ok(cert) = reqwest::Certificate::from_pem(SECTIGO_INTERMEDIATE) {
        builder = builder.add_root_certificate(cert);
    }

    Ok(builder.build().map_err(|e| format!("failed to build reqwest client: {e}"))?)
}

pub async fn get_with_redirect_follow(
    client: &reqwest::Client,
    url: &str,
    cookie_header: Option<&str>,
    max_hops: usize
) -> Result<reqwest::Response, String> {
    let mut current = reqwest::Url
        ::parse(VTOP_BASE_URL)
        .map_err(|e| format!("invalid base url: {e}"))?
        .join(url)
        .map_err(|e| format!("invalid start url '{url}': {e}"))?;

    for hop in 0..=max_hops {
        let mut req = client.get(current.clone());
        if let Some(cookies) = cookie_header {
            req = req.header(COOKIE, cookies);
        }

        let response = req.send().await.map_err(|e| format!("request failed for {current}: {e}"))?;

        if !response.status().is_redirection() {
            return Ok(response);
        }

        if hop == max_hops {
            return Err(format!("too many redirects while requesting {url}"));
        }

        let location = response
            .headers()
            .get(LOCATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| format!("redirect location missing for {current}"))?;

        current = reqwest::Url
            ::parse(VTOP_BASE_URL)
            .map_err(|e| format!("invalid base url: {e}"))?
            .join(location)
            .map_err(|e| format!("invalid redirect url: {e}"))?;
    }

    Err(format!("failed to resolve request for {url}"))
}

pub fn collect_set_cookies(response: &reqwest::Response) -> Vec<String> {
    response
        .headers()
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .filter_map(cookie_pair_from_set_cookie)
        .collect()
}

fn cookie_pair_from_set_cookie(raw: &str) -> Option<String> {
    let pair = raw.split(';').next()?.trim();
    let (name, value) = pair.split_once('=')?;
    if name.trim().is_empty() {
        return None;
    }
    Some(format!("{}={}", name.trim(), value.trim()))
}

fn cookie_name(pair: &str) -> Option<String> {
    let (name, _) = pair.split_once('=')?;
    let n = name.trim();
    if n.is_empty() {
        return None;
    }
    Some(n.to_string())
}

pub fn split_cookie_header(header: &str) -> Vec<String> {
    header
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty() && s.contains('='))
        .map(ToString::to_string)
        .collect()
}

pub fn merge_cookies(existing: &[String], new_values: &[String]) -> String {
    let mut ordered_names: Vec<String> = Vec::new();
    let mut values: HashMap<String, String> = HashMap::new();

    for pair in existing.iter().chain(new_values.iter()) {
        if let Some(name) = cookie_name(pair) {
            if !values.contains_key(&name) {
                ordered_names.push(name.clone());
            }
            values.insert(name, pair.trim().to_string());
        }
    }

    ordered_names
        .into_iter()
        .filter_map(|name| values.get(&name).cloned())
        .collect::<Vec<_>>()
        .join("; ")
}
