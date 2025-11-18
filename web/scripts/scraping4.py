import sys
from pathlib import Path
from os import chdir
from os import path

import requests
from bs4 import BeautifulSoup

chdir(path.dirname(path.abspath(__file__)))

school_id = '14' # 木更津高専のID

args = sys.argv

department_id = ['11', '12', '13', '14', '15']
department_id_alpha = ['M', 'E', 'D', 'J', 'C']
#yearをコマンドライン引数化
try:
    year = args[1]
except:
    year = '2025'

try:
    output_dir = Path(args[2]).expanduser()
except IndexError:
    output_dir = Path("./")

output_dir.mkdir(parents=True, exist_ok=True)


for department in department_id:
    url = 'https://syllabus.kosen-k.go.jp/Pages/PublicSubjects?school_id=' + school_id + '&department_id=' + department + '&year=' + year + ' &lang=ja'
    header = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://syllabus.kosen-k.go.jp/'
    }
    html = requests.get(url,headers= header)
    soup = BeautifulSoup(html.text, 'html.parser')

    subjects = []
    for element in soup.find_all(class_="mcc-hide"):
        name = element.get_text()
        subjects.append(name)
    id = []
    ippan_senmon = []
    hissyu_sentaku = []
    tanni = []
    tanni_flag = False
    for i,element in enumerate(soup.find_all('td')):
        data = element.get_text()
        id.append( str(department_id_alpha[int(department)-11])+ '-' + year + '-' + str(i))
        if data == '一般' or data == '専門':
            ippan_senmon.append(data)
        
        if '必修' in data or '選択' in data:
            hissyu_sentaku.append(data)
        
        if '単位' in data:
            tanni_flag = True
            continue

        if tanni_flag and len(data) == 1 and data != '前' and data != '後':
            tanni.append(data)
            tanni_flag = False


    cnm = [[] for i in range(5)]
    for i in range(1, 6):
        class_name = 'c' + str(i) + 'm'
        for element in soup.find_all(class_=class_name):
            name = element.get_text()
            cnm[i-1].append(name)

    grade = []
    grade_count = 0
    cnt = 0
    for i in range((int)(len(cnm[0]) / 4)):
        if cnm[grade_count][cnt] != '' or cnm[grade_count][cnt+1] != '' or cnm[grade_count][cnt+2] != '' or cnm[grade_count][cnt+3] != '':
            grade.append(grade_count + 1)
        else:
            grade_count += 1
            grade.append(grade_count + 1)
        
        cnt += 4

    file_path = output_dir / f"{department_id_alpha[int(department)-11]}_{year}.csv"
    with file_path.open("w", encoding="utf-8") as handle:
        handle.write('ID,教科名,学年,科目,区分,単位数\n')
        for i in range(len(subjects)):
            handle.write(
                f"{id[i]},{subjects[i]},{grade[i]},{ippan_senmon[i]},{hissyu_sentaku[i]},{tanni[i]}\n"
            )

        