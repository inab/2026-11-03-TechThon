{{/* The participant's path, validated. */}}
{{- define "frontend.path" -}}
{{- $path := toString .Values.path -}}
{{- if not (regexMatch "^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$" $path) -}}
{{- fail (printf "path %q is not valid. Set it with --set path=<name>, using lowercase letters, numbers and dashes, e.g. --set path=YOUR_USERNAME" $path) -}}
{{- end -}}
{{- $path -}}
{{- end -}}

{{/* "/YOUR_USERNAME/" */}}
{{- define "frontend.basePath" -}}
/{{ include "frontend.path" . }}/
{{- end -}}

{{/* "https://techbiolab.dev.bsc.es/YOUR_USERNAME/" */}}
{{- define "frontend.appUrl" -}}
{{ .Values.scheme }}://{{ .Values.host }}{{ include "frontend.basePath" . }}
{{- end -}}

{{- define "frontend.labels" -}}
app.kubernetes.io/name: workshop-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
